import { toBrowserPath } from "../base-path.ts"
import type {
  ChangeMetricViewModel,
  ConsentAuditViewModel,
  FeedbackViewModel,
  FeedPostViewModel,
  FeedViewModel,
  MyChangeViewModel,
  TodayViewModel,
} from "../../features/participant/models.ts"
import type {
  PilotParticipantChange,
  PilotParticipantFeedback,
  PilotParticipantFeed,
  PilotParticipantMetric,
  PilotParticipantToday,
} from "../../integrations/supabase/pilot-gateway.ts"
import {
  formatMonthDay,
  metricLabel,
  metricValue,
  timeAgoLabel,
} from "./pilot-coach-models.ts"

function dueLabel(dueAt: string | null): string {
  if (dueAt === null) return "기한 미정"
  const dateText = dueAt.length >= 10 ? dueAt.slice(0, 10) : dueAt
  return `${formatMonthDay(dateText)}까지`
}

function durationLabel(kind: "health" | "reflection" | "running"): string {
  return kind === "running" ? "약 20분" : "약 5분"
}

function feedbackTitle(classification: PilotParticipantFeedback["classification"]): string {
  switch (classification) {
    case "low_risk":
      return "저위험 안내"
    case "training_change":
      return "훈련 변경"
    case "pain":
      return "통증·위험"
    case "risk":
      return "통증·위험"
  }
}

function consentAuditLabel(eventType: string): string {
  switch (eventType) {
    case "consent.granted":
      return "안정 시 심박수 코치 공유 허용"
    case "consent.revoked":
      return "안정 시 심박수 코치 공유 철회"
    default:
      return "공유 설정 변경"
  }
}

function metricChangeLabel(metric: PilotParticipantMetric): string {
  return metric.count14d > 0 ? `최근 14일 ${metric.count14d}건` : "최근 기록 없음"
}

export function buildParticipantTodayModel(today: PilotParticipantToday): TodayViewModel {
  return {
    displayName: today.profile.displayName,
    dateLabel: today.dateLabel,
    ...(today.assignment === null
      ? {}
      : {
          assignment: {
            id: `assignment-${today.assignment.assignmentId}`,
            title: today.assignment.title,
            summary: today.assignment.instructions,
            dueLabel: dueLabel(today.assignment.dueAt),
            durationLabel: durationLabel(today.assignment.assignmentKind),
            status: today.assignment.completed ? "completed" : "pending",
          },
        }),
    ...(today.announcement === null
      ? {}
      : {
          announcement: {
            id: `announcement-${today.announcement.announcementId}`,
            title: today.announcement.title,
            body: today.announcement.body,
            publishedLabel: today.announcement.pinned ? "상단 공지" : "최근 공지",
          },
        }),
  }
}

export function buildParticipantFeedModel(feed: PilotParticipantFeed, origin: string): FeedViewModel {
  return {
    posts: feed.posts.map((post): FeedPostViewModel => {
      const postId: `post-${string}` = `post-${post.postId}`
      return {
        id: postId,
        authorName: post.authorName,
        body: post.body,
        createdLabel: timeAgoLabel(post.createdAt),
        heartCount: post.heartCount,
        isHearted: post.isHearted,
        comments: post.comments.map((comment) => ({
          id: `comment-${comment.commentId}`,
          authorName: comment.authorName,
          body: comment.body,
        })),
        shareUrl: `${origin}${toBrowserPath("/feed")}#${postId}`,
      }
    }),
  }
}

export function buildParticipantChangeModel(change: PilotParticipantChange): MyChangeViewModel {
  return {
    displayName: change.profile.displayName,
    metrics: [
      {
        id: "metric-program-completion",
        label: "과정 완료율",
        value: `${change.completionPercent}%`,
        changeLabel: "전체 과제 기준",
      },
      ...change.metrics.map((metric): ChangeMetricViewModel => ({
        id: `metric-${metric.metricType}`,
        label: metricLabel(metric.metricType),
        value: metricValue(metric),
        changeLabel: metricChangeLabel(metric),
      })),
    ],
    feedback: change.feedback.map((item): FeedbackViewModel => ({
      id: `feedback-${item.feedbackId}`,
      source: item.origin === "ai" ? "automated_summary" : "coach_approved",
      title: feedbackTitle(item.classification),
      body: item.body,
    })),
    consents: [
      {
        key: "consent-resting-heart-rate",
        label: "안정 시 심박수 · 코치",
        description: "코치에게만 최신 값을 공유합니다.",
        enabled: change.heartRateConsented,
      },
    ],
    consentHistory: change.consentHistory.map(
      (event): ConsentAuditViewModel => ({
        id: `audit-${event.auditEventId}`,
        label: consentAuditLabel(event.eventType),
      }),
    ),
  }
}
