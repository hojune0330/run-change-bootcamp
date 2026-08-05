import { useCallback, useEffect, useState } from "react"
import { Button } from "../../components/primitives/index.ts"
import { type BrandConfig, DEFAULT_BRAND } from "../../design/brand-config.ts"
import {
  type AssignmentDraft,
  CoachDashboard,
  type CoachDashboardHandlers,
  type CoachDashboardViewModel,
  type CohortId,
  type FeedbackId,
  type NoticeDraft,
  type ParticipantDetailViewModel,
  type ParticipantId,
  type ParticipantStatusViewModel,
  type TimeTrialConfirmation,
  type TimeTrialDecision,
  type TimeTrialDraft,
  type TimeTrialProtocol,
  type TimeTrialSession,
} from "../../features/coach/index.ts"
import type {
  PilotCoachDashboard,
  PilotGateway,
  PilotMembership,
  PilotOperationError,
} from "../../integrations/supabase/pilot-gateway.ts"
import { AppShell } from "../AppShell.tsx"
import { COACH_HREFS, type CoachHref } from "../routes.ts"
import { buildCoachDashboardModel, buildCoachParticipantDetailModel } from "./pilot-coach-models.ts"
import "./pilot-workspace.css"

type PilotCoachWorkspaceProps = {
  readonly brand?: BrandConfig
  readonly gateway: PilotGateway
  readonly membership: PilotMembership
  readonly onSignOut: () => void
  readonly signOutBusy: boolean
}

type LoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "ready" }

type DetailState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly message: string }

function operationMessage(kind: PilotOperationError["kind"]): string {
  switch (kind) {
    case "network":
      return "네트워크에 연결할 수 없습니다. 연결을 확인한 뒤 다시 시도해 주세요."
    case "provider_error":
      return "데이터 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요."
    case "signed_out":
      return "로그인 세션이 종료되었습니다. 새 로그인 링크를 요청해 주세요."
    case "invalid_request":
      return "입력 내용을 확인해 주세요."
    case "invalid_response":
      return "서버 응답을 확인하지 못했습니다. 지원팀에 문의해 주세요."
    default:
      return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."
  }
}

function emptyAssignmentDraft(): AssignmentDraft {
  return {
    title: "",
    category: "running",
    dueDate: "",
    cohortId: "all",
    instructions: "",
  }
}

function emptyNoticeDraft(): NoticeDraft {
  return { title: "", body: "", pinned: false }
}

function draftFromTimeTrial(timeTrial: PilotCoachDashboard["timeTrial"]): TimeTrialDraft {
  return timeTrial === null
    ? { session: null, protocol: null }
    : {
        session: timeTrial.initialSessionNumber === 1 ? "session_1" : "session_2",
        protocol: timeTrial.protocol,
      }
}

export function PilotCoachWorkspace({
  brand = DEFAULT_BRAND,
  gateway,
  membership,
  onSignOut,
  signOutBusy,
}: PilotCoachWorkspaceProps) {
  const [dashboard, setDashboard] = useState<PilotCoachDashboard | null>(null)
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" })
  const [query, setQuery] = useState("")
  const [activeHref, setActiveHref] = useState<CoachHref>("/coach/cohort")
  const [selectedDetail, setSelectedDetail] = useState<ParticipantDetailViewModel | null>(null)
  const [detailState, setDetailState] = useState<DetailState>({ kind: "idle" })
  const [assignmentDraft, setAssignmentDraft] = useState<AssignmentDraft>(emptyAssignmentDraft)
  const [assignmentPublishing, setAssignmentPublishing] = useState(false)
  const [noticeDraft, setNoticeDraft] = useState<NoticeDraft>(emptyNoticeDraft)
  const [noticePublishing, setNoticePublishing] = useState(false)
  const [timeTrialDraft, setTimeTrialDraft] = useState<TimeTrialDraft>({
    session: null,
    protocol: null,
  })
  const [timeTrialConfirmation, setTimeTrialConfirmation] = useState<TimeTrialConfirmation>({
    kind: "idle",
  })
  const [mutationMessage, setMutationMessage] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    const result = await gateway.getCoachDashboard(membership.programId)
    if (!result.ok) {
      setLoadState({ kind: "error", message: operationMessage(result.error.kind) })
      return
    }
    setDashboard(result.value)
    setTimeTrialDraft(draftFromTimeTrial(result.value.timeTrial))
    setLoadState({ kind: "ready" })
  }, [gateway, membership.programId])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const handleNavigate = (href: string) => {
    if (href === "/") {
      window.history.replaceState({}, "", "/")
      return
    }
    const coachHref = COACH_HREFS.find((candidate) => candidate === href)
    if (coachHref !== undefined) {
      setActiveHref(coachHref)
      window.history.replaceState({}, "", coachHref)
    }
  }

  const handleSelectParticipant = async (id: ParticipantId) => {
    setDetailState({ kind: "loading" })
    const participantId = id.replace(/^participant:/, "")
    const result = await gateway.getCoachParticipantDetail(membership.programId, participantId)
    if (!result.ok) {
      setDetailState({ kind: "error", message: operationMessage(result.error.kind) })
      return
    }
    setSelectedDetail(buildCoachParticipantDetailModel(result.value))
    setDetailState({ kind: "idle" })
  }

  const handlePublishAssignment = async () => {
    if (
      assignmentDraft.title.trim().length === 0 ||
      assignmentDraft.instructions.trim().length === 0 ||
      assignmentDraft.dueDate.length === 0
    ) {
      return
    }
    setAssignmentPublishing(true)
    setMutationMessage(null)
    const result = await gateway.publishAssignment({
      category: assignmentDraft.category,
      dueAt: new Date(`${assignmentDraft.dueDate}T23:59:59+09:00`).toISOString(),
      instructions: assignmentDraft.instructions.trim(),
      programId: membership.programId,
      title: assignmentDraft.title.trim(),
    })
    setAssignmentPublishing(false)
    if (!result.ok) {
      setMutationMessage(operationMessage(result.error.kind))
      return
    }
    setAssignmentDraft(emptyAssignmentDraft())
    void loadDashboard()
  }

  const handlePublishNotice = async () => {
    if (noticeDraft.title.trim().length === 0 || noticeDraft.body.trim().length === 0) {
      return
    }
    setNoticePublishing(true)
    setMutationMessage(null)
    const result = await gateway.publishAnnouncement({
      body: noticeDraft.body.trim(),
      pinned: noticeDraft.pinned,
      programId: membership.programId,
      title: noticeDraft.title.trim(),
    })
    setNoticePublishing(false)
    if (!result.ok) {
      setMutationMessage(operationMessage(result.error.kind))
      return
    }
    setNoticeDraft(emptyNoticeDraft())
    void loadDashboard()
  }

  const handleDecideFeedback = async (id: FeedbackId, decision: "approved" | "rejected") => {
    const result = await gateway.decideFeedback({
      decision,
      feedbackId: id.replace(/^feedback:/, ""),
    })
    if (!result.ok) {
      setMutationMessage(operationMessage(result.error.kind))
      return
    }
    setMutationMessage(null)
    void loadDashboard()
  }

  const handleTimeTrialSessionChange = (session: TimeTrialSession) => {
    setTimeTrialDraft((draft) => ({ ...draft, session }))
    setTimeTrialConfirmation({ kind: "idle" })
  }

  const handleTimeTrialProtocolChange = (protocol: TimeTrialProtocol) => {
    setTimeTrialDraft((draft) => ({ ...draft, protocol }))
    setTimeTrialConfirmation({ kind: "idle" })
  }

  const handleRequestTimeTrialChange = (decision: TimeTrialDecision) => {
    if (decision.kind === "decided") {
      setTimeTrialDraft({ session: decision.session, protocol: decision.protocol })
    }
    setTimeTrialConfirmation({ kind: "required" })
  }

  const handleCancelTimeTrialChange = () => {
    setTimeTrialConfirmation({ kind: "idle" })
  }

  const handleSaveTimeTrial = async (decision: TimeTrialDecision) => {
    if (decision.kind !== "decided") return
    const result = await gateway.saveTimeTrial({
      programId: membership.programId,
      protocol: decision.protocol,
      sessionNumber: decision.session === "session_1" ? 1 : 2,
    })
    setTimeTrialConfirmation({ kind: "idle" })
    if (!result.ok) {
      setMutationMessage(operationMessage(result.error.kind))
      return
    }
    setMutationMessage(null)
    void loadDashboard()
  }

  const rosterQuery = query.trim().toLocaleLowerCase("ko-KR")
  const filteredParticipants: ParticipantStatusViewModel[] =
    dashboard === null
      ? []
      : buildCoachDashboardModel(dashboard).participants.filter(
          (participant) =>
            rosterQuery.length === 0 ||
            participant.name.toLocaleLowerCase("ko-KR").includes(rosterQuery),
        )

  let model: CoachDashboardViewModel | null = null
  if (dashboard !== null) {
    const base = buildCoachDashboardModel(dashboard)
    const participants =
      rosterQuery.length === 0
        ? base.participants
        : base.participants.filter((participant) =>
            filteredParticipants.some((candidate) => candidate.id === participant.id),
          )
    model = {
      ...base,
      participants,
      filters: {
        ...base.filters,
        query,
        resultCount: participants.length,
      },
      assignmentDraft,
      assignmentPublishing,
      noticeDraft,
      noticePublishing,
      timeTrial: {
        ...base.timeTrial,
        draft: timeTrialDraft,
        confirmation: timeTrialConfirmation,
      },
      ...(selectedDetail === null ? {} : { selectedParticipant: selectedDetail }),
    }
  }

  const handlers: CoachDashboardHandlers = {
    onQueryChange: setQuery,
    onCohortChange: (cohortId: CohortId | "all") => {
      if (cohortId === "all") return
      const base = dashboard === null ? null : buildCoachDashboardModel(dashboard)
      if (base?.cohortOptions.some((option) => option.id === cohortId)) {
        return
      }
    },
    onSelectParticipant: (id) => void handleSelectParticipant(id),
    onAssignmentDraftChange: setAssignmentDraft,
    onPublishAssignment: () => void handlePublishAssignment(),
    onNoticeDraftChange: setNoticeDraft,
    onPublishNotice: () => void handlePublishNotice(),
    onApproveFeedback: (id) => void handleDecideFeedback(id, "approved"),
    onAutoApproveFeedback: (id) => void handleDecideFeedback(id, "approved"),
    onRejectFeedback: (id) => void handleDecideFeedback(id, "rejected"),
    onTimeTrialSessionChange: handleTimeTrialSessionChange,
    onTimeTrialProtocolChange: handleTimeTrialProtocolChange,
    onSaveTimeTrial: (decision) => void handleSaveTimeTrial(decision),
    onRequestTimeTrialChange: handleRequestTimeTrialChange,
    onConfirmTimeTrialChange: (decision) => void handleSaveTimeTrial(decision),
    onCancelTimeTrialChange: handleCancelTimeTrialChange,
  }

  if (loadState.kind === "loading" && dashboard === null) {
    return (
      <main className="pilot-workspace" data-runtime-mode="pilot" id="main-content">
        <p aria-live="polite" className="pilot-workspace__status">
          코치 대시보드를 불러오고 있습니다.
        </p>
      </main>
    )
  }
  if (loadState.kind === "error" && dashboard === null) {
    return (
      <main className="pilot-workspace" data-runtime-mode="pilot" id="main-content">
        <p className="pilot-workspace__status pilot-workspace__status--error" role="alert">
          {loadState.message}
        </p>
        <Button onClick={() => void loadDashboard()} variant="secondary">
          다시 시도
        </Button>
      </main>
    )
  }
  if (dashboard === null || model === null) return null

  return (
    <AppShell
      activeHref={activeHref}
      brand={brand}
      mode="coach"
      onNavigate={handleNavigate}
      sessionLabel={`${brand.productName} 코치`}
    >
      <div className="pilot-workspace">
        <header className="pilot-workspace__session">
          <p>
            <span>{brand.productName} 코치</span>
            <strong>{membership.email ?? membership.userId}</strong>
          </p>
          <Button busy={signOutBusy} onClick={onSignOut} variant="secondary">
            로그아웃
          </Button>
        </header>
        {mutationMessage !== null ? (
          <p className="pilot-workspace__status pilot-workspace__status--error" role="alert">
            {mutationMessage}
          </p>
        ) : null}
        {detailState.kind === "error" ? (
          <p className="pilot-workspace__status pilot-workspace__status--error" role="alert">
            {detailState.message}
          </p>
        ) : null}
        <CoachDashboard handlers={handlers} model={model} />
      </div>
    </AppShell>
  )
}
