import { useCallback, useEffect, useState } from "react"
import { Button } from "../../components/primitives/index.ts"
import { createShareServices } from "../../demo/participant-bindings.ts"
import { type BrandConfig, DEFAULT_BRAND } from "../../design/brand-config.ts"
import {
  FeedScreen,
  type Loadable,
  MyChangeScreen,
  RecordScreen,
  TodayScreen,
} from "../../features/participant/index.ts"
import type {
  ActionResult,
  AssignmentId,
  ConsentChangeResult,
  DraftResult,
  FeedViewModel,
  ManualMetricInput,
  MyChangeViewModel,
  PostId,
  RecordViewModel,
  TodayViewModel,
} from "../../features/participant/models.ts"
import type {
  PilotGateway,
  PilotMembership,
  PilotOperationError,
} from "../../integrations/supabase/pilot-gateway.ts"
import { AppShell } from "../AppShell.tsx"
import { PARTICIPANT_HREFS, type ParticipantHref } from "../routes.ts"
import {
  buildParticipantChangeModel,
  buildParticipantFeedModel,
  buildParticipantRecordModel,
  buildParticipantTodayModel,
} from "./pilot-participant-models.ts"
import "./pilot-workspace.css"

type PilotParticipantWorkspaceProps = {
  readonly brand?: BrandConfig
  readonly gateway: PilotGateway
  readonly membership: PilotMembership
  readonly onSignOut: () => void
  readonly signOutBusy: boolean
}

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

function pilotDraftError(): DraftResult {
  return { kind: "error", message: "파일 가져오기는 파일럿 준비 중이에요." }
}

export function PilotParticipantWorkspace({
  brand = DEFAULT_BRAND,
  gateway,
  membership,
  onSignOut,
  signOutBusy,
}: PilotParticipantWorkspaceProps) {
  const [activeHref, setActiveHref] = useState<ParticipantHref>("/today")
  const [todayState, setTodayState] = useState<Loadable<TodayViewModel>>({ status: "loading" })
  const [feedState, setFeedState] = useState<Loadable<FeedViewModel>>({ status: "loading" })
  const [changeState, setChangeState] = useState<Loadable<MyChangeViewModel>>({
    status: "loading",
  })
  const [recordState, setRecordState] = useState<Loadable<RecordViewModel>>({
    status: "loading",
  })
  const [mutationMessage, setMutationMessage] = useState<string | null>(null)

  const loadToday = useCallback(async () => {
    setTodayState({ status: "loading" })
    const result = await gateway.getParticipantToday(membership.programId)
    if (!result.ok) {
      setTodayState({ status: "error", message: operationMessage(result.error.kind) })
      return
    }
    setTodayState({ status: "ready", data: buildParticipantTodayModel(result.value) })
  }, [gateway, membership.programId])

  const loadFeed = useCallback(async () => {
    setFeedState({ status: "loading" })
    const result = await gateway.getParticipantFeed(membership.programId)
    if (!result.ok) {
      setFeedState({ status: "error", message: operationMessage(result.error.kind) })
      return
    }
    setFeedState({
      status: "ready",
      data: buildParticipantFeedModel(result.value, window.location.origin),
    })
  }, [gateway, membership.programId])

  const loadChange = useCallback(async () => {
    setChangeState({ status: "loading" })
    const result = await gateway.getParticipantChange(membership.programId)
    if (!result.ok) {
      setChangeState({ status: "error", message: operationMessage(result.error.kind) })
      return
    }
    setChangeState({ status: "ready", data: buildParticipantChangeModel(result.value) })
  }, [gateway, membership.programId])

  const loadRecord = useCallback(async () => {
    setRecordState({ status: "loading" })
    const result = await gateway.getParticipantRecord(membership.programId)
    if (!result.ok) {
      setRecordState({ status: "error", message: operationMessage(result.error.kind) })
      return
    }
    setRecordState({ status: "ready", data: buildParticipantRecordModel(result.value) })
  }, [gateway, membership.programId])

  useEffect(() => {
    void loadToday()
  }, [loadToday])

  useEffect(() => {
    void loadFeed()
  }, [loadFeed])

  useEffect(() => {
    void loadChange()
  }, [loadChange])

  useEffect(() => {
    void loadRecord()
  }, [loadRecord])

  const handleNavigate = (href: string) => {
    if (href === "/") {
      window.history.replaceState({}, "", "/")
      return
    }
    const participantHref = PARTICIPANT_HREFS.find((candidate) => candidate === href)
    if (participantHref !== undefined) {
      setActiveHref(participantHref)
      window.history.replaceState({}, "", participantHref)
    }
  }

  const completeAssignment = async (id: AssignmentId): Promise<ActionResult> => {
    const assignmentId = id.replace(/^assignment-/, "")
    const result = await gateway.completeAssignment({
      assignmentId,
      programId: membership.programId,
    })
    if (!result.ok) {
      setMutationMessage(operationMessage(result.error.kind))
      return { kind: "error", message: operationMessage(result.error.kind) }
    }
    setMutationMessage(null)
    void loadToday()
    return { kind: "success" }
  }

  const setPostHeart = async (id: PostId, hearted: boolean): Promise<ActionResult> => {
    const postId = id.replace(/^post-/, "")
    const result = await gateway.setPostHeart({ hearted, postId })
    if (!result.ok) {
      setMutationMessage(operationMessage(result.error.kind))
      return { kind: "error", message: operationMessage(result.error.kind) }
    }
    setMutationMessage(null)
    void loadFeed()
    return { kind: "success" }
  }

  const addPostComment = async (id: PostId, body: string): Promise<ActionResult> => {
    const postId = id.replace(/^post-/, "")
    const result = await gateway.addPostComment({ body, postId })
    if (!result.ok) {
      setMutationMessage(operationMessage(result.error.kind))
      return { kind: "error", message: operationMessage(result.error.kind) }
    }
    setMutationMessage(null)
    void loadFeed()
    return { kind: "success" }
  }

  const saveManualMetric = async (input: ManualMetricInput): Promise<ActionResult> => {
    const result = await gateway.saveManualMetric({
      ...input,
      programId: membership.programId,
    })
    if (!result.ok) {
      setMutationMessage(operationMessage(result.error.kind))
      return { kind: "error", message: operationMessage(result.error.kind) }
    }
    setMutationMessage(null)
    void loadChange()
    return { kind: "success" }
  }

  const onChangeConsent = async (request: {
    readonly enabled: boolean
    readonly key: string
  }): Promise<ConsentChangeResult> => {
    const result = await gateway.changeMetricConsent({
      enabled: request.enabled,
      programId: membership.programId,
    })
    if (!result.ok) {
      setMutationMessage(operationMessage(result.error.kind))
      return { kind: "error", message: operationMessage(result.error.kind) }
    }
    setMutationMessage(null)
    if (result.value.status === "unavailable") {
      return {
        kind: "error",
        message: "아직 코치와 공유할 심박수 기록이 없어요. 먼저 기록을 추가해 주세요.",
      }
    }
    void loadChange()
    const eventType = result.value.auditEventType ?? "consent.granted"
    const label =
      eventType === "consent.revoked"
        ? "안정 시 심박수 코치 공유 철회"
        : "안정 시 심박수 코치 공유 허용"
    return {
      kind: "success",
      auditEntry: {
        id: `audit-${result.value.auditEventId ?? eventType}`,
        label,
      },
    }
  }

  const shareServices = createShareServices(window.navigator)

  const retry = () => {
    if (activeHref === "/today") void loadToday()
    if (activeHref === "/feed") void loadFeed()
    if (activeHref === "/change") void loadChange()
    if (activeHref === "/record") void loadRecord()
  }

  return (
    <AppShell
      activeHref={activeHref}
      brand={brand}
      mode="participant"
      onNavigate={handleNavigate}
      sessionLabel={`${brand.productName} 참여자`}
    >
      <div className="pilot-workspace">
        <header className="pilot-workspace__session">
          <p>
            <span>{brand.productName} 참여자</span>
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
        {activeHref === "/today" ? (
          <TodayScreen
            brand={brand}
            handlers={{
              onCompleteAssignment: (id) => completeAssignment(id),
            }}
            onRetry={() => void retry()}
            state={todayState}
          />
        ) : null}
        {activeHref === "/feed" ? (
          <FeedScreen
            brand={brand}
            handlers={{
              onComment: (id, body) => addPostComment(id, body),
              onHeart: (id, hearted) => setPostHeart(id, hearted),
            }}
            onRetry={() => void retry()}
            shareServices={shareServices}
            state={feedState}
          />
        ) : null}
        {activeHref === "/record" ? (
          <RecordScreen
            handlers={{
              onImportFile: () => Promise.resolve(pilotDraftError()),
              onSaveDraft: async () => ({
                kind: "error",
                message: "초안 저장은 파일럿 준비 중이에요.",
              }),
              onSaveManual: (input) => saveManualMetric(input),
              onUploadScreenshot: () => Promise.resolve(pilotDraftError()),
            }}
            onRetry={() => void retry()}
            state={recordState}
          />
        ) : null}
        {activeHref === "/change" ? (
          <MyChangeScreen
            brand={brand}
            handlers={{ onConsentChange: (req) => onChangeConsent(req) }}
            onRetry={() => void retry()}
            state={changeState}
          />
        ) : null}
      </div>
    </AppShell>
  )
}
