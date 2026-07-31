import { toBrowserPath } from "../app/base-path.ts"
import type {
  FeedViewModel,
  MyChangeViewModel,
  RecordViewModel,
  TodayViewModel,
} from "../features/participant/index.ts"
import type { ChangeMetricViewModel } from "../features/participant/models.ts"
import { DEMO_PARTICIPANTS } from "../fixtures/index.ts"
import type { DemoParticipantId, DemoState } from "./state.ts"

class MissingDemoParticipantError extends Error {
  readonly name = "MissingDemoParticipantError"
}

function participant(id: DemoParticipantId) {
  const found = DEMO_PARTICIPANTS.find((item) => item.id === id)
  if (found === undefined) throw new MissingDemoParticipantError(`Missing demo participant: ${id}`)
  return found
}

export function todayModel(state: DemoState, participantId: DemoParticipantId): TodayViewModel {
  const member = participant(participantId)
  const assignment = state.assignments.at(-1)
  const notice = state.notices.at(-1)
  return {
    displayName: member.displayName,
    dateLabel: "8월 31일 월요일",
    ...(assignment === undefined
      ? {}
      : {
          assignment: {
            id: assignment.id,
            title: assignment.title,
            summary: assignment.summary,
            dueLabel: `${assignment.dueDate}까지`,
            durationLabel: assignment.category === "running" ? "약 20분" : "약 5분",
            status: state.completions.some(
              (item) => item.participantId === participantId && item.assignmentId === assignment.id,
            )
              ? "completed"
              : "pending",
          },
        }),
    ...(notice === undefined
      ? {}
      : {
          announcement: {
            id: notice.id,
            title: notice.title,
            body: notice.body,
            publishedLabel: notice.pinned ? "상단 공지" : "최근 공지",
          },
        }),
  }
}

export function feedModel(state: DemoState, participantId: DemoParticipantId): FeedViewModel {
  return {
    posts: state.posts.map((post) => ({
      id: post.id,
      authorName: participant(post.authorId).displayName,
      body: post.body,
      createdLabel: post.createdLabel,
      heartCount: post.baseHeartCount + post.heartedBy.length,
      isHearted: post.heartedBy.includes(participantId),
      comments: post.comments.map((comment) => ({
        id: comment.id,
        authorName: participant(comment.authorId).displayName,
        body: comment.body,
      })),
      shareUrl: `${window.location.origin}${toBrowserPath("/feed")}#${post.id}`,
    })),
  }
}

export function recordModel(): RecordViewModel {
  return {
    recordedOn: "2026-08-31",
    supportedExtensions: ["csv", "fit", "gpx", "tcx", "xml", "json"],
  }
}

export function myChangeModel(
  state: DemoState,
  participantId: DemoParticipantId,
): MyChangeViewModel {
  const member = participant(participantId)
  const savedDraftMetrics = state.drafts
    .filter((draft) => draft.participantId === participantId && draft.status === "saved")
    .flatMap((draft) =>
      draft.metrics.map<ChangeMetricViewModel>((metric, index) => ({
        id: `metric-${draft.id}-${index}`,
        label: metric.label,
        value: metric.value,
        changeLabel: draft.source === "file" ? "파일 초안" : "스크린샷 초안",
      })),
    )
  const recordedMetrics = state.metrics
    .filter((metric) => metric.participantId === participantId)
    .map((metric) => ({
      id: metric.id,
      label: metric.label,
      value: metric.value,
      changeLabel: metric.changeLabel,
    }))
  return {
    displayName: member.displayName,
    metrics: [
      {
        id: "metric-program-completion",
        label: "과정 완료율",
        value: `${member.completionPercent}%`,
        changeLabel: "시드 기준",
      },
      ...recordedMetrics,
      ...savedDraftMetrics,
    ],
    feedback: state.deliveredFeedback
      .filter((item) => item.participantId === participantId)
      .map((item) => ({
        id: item.id,
        source: item.source,
        title: item.title,
        body: item.body,
      })),
    consents: [
      {
        key: "consent-resting-heart-rate",
        label: "안정 시 심박수 · 코치",
        description: "코치에게만 최신 값을 공유합니다.",
        enabled: state.consentedParticipants.includes(participantId),
      },
    ],
    consentHistory: state.consentEvents
      .filter((item) => item.participantId === participantId)
      .map((item) => ({ id: item.id, label: item.label })),
  }
}
