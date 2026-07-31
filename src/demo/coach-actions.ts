import type {
  AssignmentDraft,
  FeedbackId,
  NoticeDraft,
  TimeTrialDecision,
  TimeTrialProtocol,
  TimeTrialSession,
} from "../features/coach/index.ts"
import type { DemoParticipantId, DemoState } from "./state.ts"

export function publishAssignment(state: DemoState): DemoState {
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
    assignmentDraft: { ...draft, title: "", instructions: "" },
    sequence: state.sequence + 1,
  }
}

export function publishNotice(state: DemoState): DemoState {
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
    noticeDraft: { ...draft, title: "", body: "", pinned: false },
    sequence: state.sequence + 1,
  }
}

export function resolveFeedback(
  state: DemoState,
  feedbackId: FeedbackId,
  decision: "approved" | "rejected",
): DemoState {
  const item = state.feedbackQueue.find((feedback) => feedback.id === feedbackId)
  if (item === undefined) return state
  const remaining = state.feedbackQueue.filter((feedback) => feedback.id !== feedbackId)
  if (decision === "rejected") return { ...state, feedbackQueue: remaining }
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

export function saveTimeTrial(state: DemoState, decision: TimeTrialDecision): DemoState {
  switch (decision.kind) {
    case "undecided":
      return {
        ...state,
        timeTrialDecision: decision,
        timeTrialDraft: { session: null, protocol: null },
        timeTrialConfirmation: "idle",
      }
    case "decided":
      return {
        ...state,
        timeTrialDecision: decision,
        timeTrialDraft: { session: decision.session, protocol: decision.protocol },
        timeTrialConfirmation: "idle",
      }
  }
}
