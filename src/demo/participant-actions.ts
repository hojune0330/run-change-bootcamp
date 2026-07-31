import type {
  ConsentChangeResult,
  DraftId,
  ManualMetricInput,
  PostId,
} from "../features/participant/models.ts"
import type { DemoDraft, DemoParticipantId, DemoState } from "./state.ts"

type CompletionInput = {
  readonly participantId: DemoParticipantId
  readonly assignmentId: DemoState["assignments"][number]["id"]
}

type HeartInput = {
  readonly participantId: DemoParticipantId
  readonly postId: PostId
  readonly hearted: boolean
}

type CommentInput = {
  readonly participantId: DemoParticipantId
  readonly postId: PostId
  readonly body: string
}

function manualMetricPresentation(input: ManualMetricInput) {
  switch (input.metricKey) {
    case "distance_km":
      return { label: "주간 거리", value: `${input.value.toFixed(1)} km` }
    case "duration_min":
      return { label: "운동 시간", value: `${input.value.toFixed(0)}분` }
    case "resting_heart_rate":
      return { label: "안정 시 심박수", value: `${input.value.toFixed(0)} bpm` }
    case "sleep_hours":
      return { label: "수면 시간", value: `${input.value.toFixed(1)}시간` }
  }
}

export function completeAssignment(state: DemoState, input: CompletionInput): DemoState {
  const assignment = state.assignments.find((item) => item.id === input.assignmentId)
  if (assignment === undefined) return state
  const alreadyCompleted = state.completions.some(
    (item) =>
      item.participantId === input.participantId && item.assignmentId === input.assignmentId,
  )
  if (alreadyCompleted) return state
  const postId: DemoState["posts"][number]["id"] = `post-completion-${input.assignmentId}-${input.participantId}`
  const post: DemoState["posts"][number] = {
    id: postId,
    authorId: input.participantId,
    body: `${assignment.title}를 완료했어요.`,
    createdLabel: "방금 전",
    baseHeartCount: 0,
    heartedBy: [],
    comments: [],
  }
  return {
    ...state,
    completions: [...state.completions, input],
    posts: state.posts.some((item) => item.id === postId) ? state.posts : [post, ...state.posts],
  }
}

export function setHeart(state: DemoState, input: HeartInput): DemoState {
  const post = state.posts.find((item) => item.id === input.postId)
  if (post === undefined) return state
  const currentlyHearted = post.heartedBy.includes(input.participantId)
  if (currentlyHearted === input.hearted) return state
  return {
    ...state,
    posts: state.posts.map((item) =>
      item.id === input.postId
        ? {
            ...item,
            heartedBy: input.hearted
              ? [...item.heartedBy, input.participantId]
              : item.heartedBy.filter((id) => id !== input.participantId),
          }
        : item,
    ),
  }
}

export function addComment(state: DemoState, input: CommentInput): DemoState {
  const trimmed = input.body.trim()
  const post = state.posts.find((item) => item.id === input.postId)
  if (post === undefined || trimmed.length === 0) return state
  const comment: DemoState["posts"][number]["comments"][number] = {
    id: `comment-demo-${state.sequence}`,
    authorId: input.participantId,
    body: trimmed,
  }
  return {
    ...state,
    posts: state.posts.map((item) =>
      item.id === input.postId ? { ...item, comments: [...item.comments, comment] } : item,
    ),
    sequence: state.sequence + 1,
  }
}

export function saveManualMetric(
  state: DemoState,
  participantId: DemoParticipantId,
  input: ManualMetricInput,
): DemoState {
  const presentation = manualMetricPresentation(input)
  const metric: DemoState["metrics"][number] = {
    id: `metric-manual-${state.sequence}`,
    participantId,
    label: presentation.label,
    value: presentation.value,
    changeLabel: `${input.recordedOn} 직접 입력`,
    source: "manual",
  }
  return { ...state, metrics: [...state.metrics, metric], sequence: state.sequence + 1 }
}

export function storeDraft(state: DemoState, draft: DemoDraft): DemoState {
  return state.drafts.some((item) => item.id === draft.id)
    ? state
    : { ...state, drafts: [...state.drafts, draft] }
}

export function saveDraft(state: DemoState, participantId: DemoParticipantId, id: DraftId) {
  const draft = state.drafts.find((item) => item.id === id && item.participantId === participantId)
  if (draft === undefined) return state
  return {
    ...state,
    drafts: state.drafts.map((item) => (item.id === id ? { ...item, status: "saved" } : item)),
  } satisfies DemoState
}

export function changeConsent(
  state: DemoState,
  participantId: DemoParticipantId,
  enabled: boolean,
): { readonly state: DemoState; readonly result: ConsentChangeResult } {
  const currentlyEnabled = state.consentedParticipants.includes(participantId)
  if (currentlyEnabled === enabled) {
    return { state, result: { kind: "error", message: "이미 같은 공유 상태예요." } }
  }
  const event: DemoState["consentEvents"][number] = {
    id: `audit-consent-${state.sequence}`,
    participantId,
    kind: enabled ? "granted" : "revoked",
    label: enabled ? "안정 시 심박수 코치 공유 허용" : "안정 시 심박수 코치 공유 철회",
  }
  const nextState: DemoState = {
    ...state,
    consentedParticipants: enabled
      ? [...state.consentedParticipants, participantId]
      : state.consentedParticipants.filter((id) => id !== participantId),
    revokedParticipants:
      enabled || state.revokedParticipants.includes(participantId)
        ? state.revokedParticipants
        : [...state.revokedParticipants, participantId],
    consentEvents: [...state.consentEvents, event],
    sequence: state.sequence + 1,
  }
  return {
    state: nextState,
    result: { kind: "success", auditEntry: { id: event.id, label: event.label } },
  }
}
