import type {
  AssignmentDraft,
  FeedbackId,
  NoticeDraft,
  TimeTrialDecision,
  TimeTrialProtocol,
  TimeTrialSession,
} from "../features/coach/index.ts"
import { DEMO_PARTICIPANTS } from "../fixtures/index.ts"
import type {
  ActivityAction,
  ActivityActor,
  ActivityLogEntry,
  DemoParticipantId,
  DemoState,
} from "./state.ts"

function participantName(participantId: DemoParticipantId): string {
  return (
    DEMO_PARTICIPANTS.find((member) => member.id === participantId)?.displayName ?? participantId
  )
}

function sessionLabel(session: "session_1" | "session_2"): string {
  return session === "session_1" ? "1회차" : "2회차"
}

function protocolLabel(protocol: TimeTrialProtocol): string {
  switch (protocol) {
    case "12_minute":
      return "12분"
    case "3k":
      return "3K"
    case "5k":
      return "5K"
  }
}

function appendActivity(
  state: DemoState,
  actor: ActivityActor | null,
  action: ActivityAction,
  summary: string,
): readonly ActivityLogEntry[] {
  if (actor === null) return state.activityLog
  return [
    ...state.activityLog,
    {
      id: `activity-${state.sequence}`,
      actor,
      action,
      summary,
      createdAtLabel: "방금 전",
    },
  ]
}

export function publishAssignment(state: DemoState, actor: ActivityActor | null): DemoState {
  const draft = state.assignmentDraft
  if (draft.title.trim().length === 0 || draft.instructions.trim().length === 0) return state
  const assignment: DemoState["assignments"][number] = {
    id: `assignment-coach-${state.sequence}`,
    title: draft.title.trim(),
    summary: draft.instructions.trim(),
    dueDate: draft.dueDate,
    category: draft.category,
  }
  return {
    ...state,
    assignments: [...state.assignments, assignment],
    activityLog: appendActivity(
      state,
      actor,
      "assignment_publish",
      `과제 발행 · ${draft.title.trim()}`,
    ),
    assignmentDraft: { ...draft, title: "", instructions: "" },
    sequence: state.sequence + 1,
  }
}

export function publishNotice(state: DemoState, actor: ActivityActor | null): DemoState {
  const draft = state.noticeDraft
  if (draft.title.trim().length === 0 || draft.body.trim().length === 0) return state
  const notice: DemoState["notices"][number] = {
    id: `announcement-coach-${state.sequence}`,
    title: draft.title.trim(),
    body: draft.body.trim(),
    pinned: draft.pinned,
  }
  return {
    ...state,
    notices: [...state.notices, notice],
    activityLog: appendActivity(
      state,
      actor,
      "notice_publish",
      `공지 발행 · ${draft.title.trim()}`,
    ),
    noticeDraft: { ...draft, title: "", body: "", pinned: false },
    sequence: state.sequence + 1,
  }
}

export function resolveFeedback(
  state: DemoState,
  feedbackId: FeedbackId,
  decision: "approved" | "rejected",
  actor: ActivityActor | null,
): DemoState {
  const item = state.feedbackQueue.find((feedback) => feedback.id === feedbackId)
  if (item === undefined) return state
  const remaining = state.feedbackQueue.filter((feedback) => feedback.id !== feedbackId)
  const name = participantName(item.participantId)
  if (decision === "rejected") {
    return {
      ...state,
      feedbackQueue: remaining,
      activityLog: appendActivity(state, actor, "feedback_reject", `피드백 반려 · ${name}`),
      sequence: state.sequence + 1,
    }
  }
  const delivered: DemoState["deliveredFeedback"][number] = {
    id: `feedback-delivered-${state.sequence}`,
    participantId: item.participantId,
    source: item.kind === "low_risk" ? "automated_summary" : "coach_approved",
    title: item.kind === "low_risk" ? "회복 안내" : "코치 확인 피드백",
    body: item.summary,
  }
  return {
    ...state,
    feedbackQueue: remaining,
    deliveredFeedback: [...state.deliveredFeedback, delivered],
    activityLog: appendActivity(state, actor, "feedback_approve", `피드백 승인 · ${name}`),
    sequence: state.sequence + 1,
  }
}

export function updateAssignmentDraft(state: DemoState, draft: AssignmentDraft): DemoState {
  return { ...state, assignmentDraft: draft }
}

export function updateNoticeDraft(state: DemoState, draft: NoticeDraft): DemoState {
  return { ...state, noticeDraft: draft }
}

export function selectParticipant(state: DemoState, participantId: DemoParticipantId): DemoState {
  return { ...state, selectedParticipantId: participantId }
}

export function updateTimeTrialSession(state: DemoState, session: TimeTrialSession): DemoState {
  return {
    ...state,
    timeTrialDraft: { ...state.timeTrialDraft, session },
    timeTrialConfirmation: "idle",
  }
}

export function updateTimeTrialProtocol(state: DemoState, protocol: TimeTrialProtocol): DemoState {
  return {
    ...state,
    timeTrialDraft: { ...state.timeTrialDraft, protocol },
    timeTrialConfirmation: "idle",
  }
}

export function saveTimeTrial(
  state: DemoState,
  decision: TimeTrialDecision,
  actor: ActivityActor | null,
): DemoState {
  const summary =
    decision.kind === "decided"
      ? `첫 기록 측정 저장 · ${sessionLabel(decision.session)} ${protocolLabel(decision.protocol)}`
      : "첫 기록 측정 저장 · 미정"
  const idle: DemoState["timeTrialConfirmation"] = "idle"
  const next = {
    ...state,
    timeTrialDecision: decision,
    timeTrialConfirmation: idle,
    activityLog: appendActivity(state, actor, "time_trial_save", summary),
  }
  switch (decision.kind) {
    case "undecided":
      return { ...next, timeTrialDraft: { session: null, protocol: null } }
    case "decided":
      return {
        ...next,
        timeTrialDraft: { session: decision.session, protocol: decision.protocol },
      }
  }
}
