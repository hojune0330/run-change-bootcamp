import type { ActivityAction } from "../../demo/state.ts"
import type {
  AdminActivityEntry,
  AdminDashboardViewModel,
  AdminMemberRow,
} from "../../features/admin/index.ts"
import type {
  PilotAdminActivity,
  PilotAdminOverview,
} from "../../integrations/supabase/pilot-gateway.ts"
import { timeAgoLabel } from "./pilot-coach-models.ts"

function formatDateRange(startsOn: string, endsOn: string): string {
  const start = new Date(`${startsOn}T00:00:00`)
  const end = new Date(`${endsOn}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startsOn} — ${endsOn}`
  }
  const begin = `${String(start.getFullYear()).padStart(4, "0")}.${String(start.getMonth() + 1).padStart(2, "0")}.${String(start.getDate()).padStart(2, "0")}`
  const finish = `${end.getMonth() + 1}.${String(end.getDate()).padStart(2, "0")}`
  return `${begin} — ${finish}`
}

function timeTrialProtocolLabel(protocol: "12_minute" | "3k" | "5k"): string {
  switch (protocol) {
    case "12_minute":
      return "12분"
    case "3k":
      return "3K"
    case "5k":
      return "5K"
  }
}

function progressLabel(percent: number): string {
  if (percent >= 80) return "순조로움"
  if (percent >= 50) return "진행 중"
  return "시작 단계"
}

export function adminActivityEntry(entry: PilotAdminActivity): AdminActivityEntry {
  const action: ActivityAction =
    entry.eventType === "feedback.approved"
      ? "feedback_approve"
      : entry.eventType === "feedback.rejected"
        ? "feedback_reject"
        : "notice_publish"
  const actionLabel =
    action === "feedback_approve"
      ? "피드백 승인"
      : action === "feedback_reject"
        ? "피드백 반려"
        : "공지 발행"
  const tone: AdminActivityEntry["tone"] =
    action === "feedback_reject" ? "warning" : action === "feedback_approve" ? "success" : "default"
  return {
    id: `activity:${entry.auditEventId}`,
    actor: entry.actorRole,
    actorLabel: entry.actorRole === "admin" ? "관리자" : "코치",
    action,
    actionLabel,
    tone,
    summary: entry.summary,
    createdAtLabel: timeAgoLabel(entry.occurredAt),
  }
}

function adminMemberRow(member: PilotAdminOverview["members"][number]): AdminMemberRow {
  return {
    id: `member:${member.profileId}`,
    name: member.displayName,
    cohortLabel: "RUN CHANGE",
    completionPercent: member.completionPercent,
    progressLabel: progressLabel(member.completionPercent),
    shareLabel: member.heartRateShared ? "공유 중" : "기본 비공개",
    shareTone: member.heartRateShared ? "success" : "neutral",
  }
}

export const ACTION_OPTIONS = [
  { value: "feedback_approve", label: "피드백 승인" },
  { value: "feedback_reject", label: "피드백 반려" },
] as const

export function buildAdminOverviewModel(overview: PilotAdminOverview): AdminDashboardViewModel {
  const timeTrialLabel =
    overview.timeTrial === null
      ? "미정"
      : `${
          overview.timeTrial.initialSessionNumber === 1 ? "1회차" : "2회차"
        } · ${timeTrialProtocolLabel(overview.timeTrial.protocol)}`
  const activity = overview.activity.map(adminActivityEntry)
  return {
    programName: overview.program.title,
    dateRangeLabel: formatDateRange(overview.program.startsOn, overview.program.endsOn),
    operationStatusLabel:
      overview.program.status === "active"
        ? "정상 운영"
        : overview.program.status === "completed"
          ? "운영 종료"
          : overview.program.status === "archived"
            ? "보관됨"
            : "준비 중",
    timeTrialLabel,
    consentedCount: overview.summary.consentedCount,
    assignmentsCount: overview.summary.assignmentsCount,
    kpis: [
      {
        id: "members",
        label: "등록 멤버",
        value: `${overview.summary.totalParticipants}명`,
        hint: "참여자 수",
      },
      {
        id: "consent",
        label: "건강 공유",
        value: `${overview.summary.consentedCount}명`,
        hint: "항목별 동의",
      },
      {
        id: "assignments",
        label: "발행 과제",
        value: `${overview.summary.assignmentsCount}건`,
        hint: "누적 발행",
      },
      {
        id: "feedback",
        label: "피드백 대기",
        value: `${overview.summary.pendingFeedbackCount}건`,
        hint: "승인 필요",
      },
      {
        id: "pain_risk",
        label: "통증·위험",
        value: `${overview.summary.painRiskCount}건`,
        hint: "코치 확인",
      },
    ],
    activity,
    recentActivity: activity.slice(0, 6),
    actionOptions: ACTION_OPTIONS,
    members: overview.members.map(adminMemberRow),
  }
}
