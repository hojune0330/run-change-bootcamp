import type { ActivityAction } from "../../demo/state.ts"
import type {
  AdminActivityEntry,
  AdminDashboardViewModel,
  AdminFailedNotificationRow,
  AdminMemberRosterRow,
  AdminMemberRow,
  AdminMembersViewModel,
  AdminReportCell,
  AdminReportsViewModel,
  AdminScheduleViewModel,
  AdminSettingsRow,
  AdminSettingsViewModel,
} from "../../features/admin/index.ts"
import type {
  PilotAdminActivity,
  PilotAdminMembers,
  PilotAdminOverview,
  PilotAdminReport,
  PilotAdminSchedule,
  PilotAdminSettings,
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

function adminMemberRosterRow(member: PilotAdminMembers["members"][number]): AdminMemberRosterRow {
  const roleLabel =
    member.role === "admin"
      ? "관리자"
      : member.role === "coach"
        ? "코치"
        : member.role === "stakeholder"
          ? "이해관계자"
          : "참여자"
  const statusLabel =
    member.status === "active" ? "활동 중" : member.status === "paused" ? "일시 중지" : "종료"
  return {
    id: `member:${member.profileId}`,
    name: member.displayName,
    email: member.email,
    role: member.role,
    roleLabel,
    status: member.status,
    statusLabel,
    joinedAtLabel: timeAgoLabel(member.joinedAt),
    completionPercent: member.completionPercent,
    progressLabel: progressLabel(member.completionPercent),
    shareLabel: member.heartRateShared ? "공유 중" : "기본 비공개",
    shareTone: member.heartRateShared ? "success" : "neutral",
  }
}

export function buildAdminMembersModel(members: PilotAdminMembers): AdminMembersViewModel {
  return {
    programName: members.program.title,
    dateRangeLabel: formatDateRange(members.program.startsOn, members.program.endsOn),
    summary: {
      totalMembers: members.summary.totalMembers,
      activeParticipants: members.summary.activeParticipants,
      activeCoaches: members.summary.activeCoaches,
      consentedCount: members.summary.consentedCount,
    },
    members: members.members.map(adminMemberRosterRow),
  }
}

function adminScheduleSessionRow(
  session: PilotAdminSchedule["sessions"][number],
): AdminScheduleViewModel["sessions"][number] {
  const kindLabel =
    session.sessionKind === "onboarding"
      ? "온보딩"
      : session.sessionKind === "easy"
        ? "이지런"
        : session.sessionKind === "time_trial"
          ? "기록 측정"
          : session.sessionKind === "recovery"
            ? "회복"
            : session.sessionKind === "technique"
              ? "테크닉"
              : session.sessionKind === "retest"
                ? "재측정"
                : "훈련"
  return {
    id: `session:${session.sessionId}`,
    sessionNumber: session.sessionNumber,
    kindLabel,
    title: session.title,
    scheduledAtLabel: timeAgoLabel(session.scheduledAt),
  }
}

export function buildAdminScheduleModel(schedule: PilotAdminSchedule): AdminScheduleViewModel {
  const timeTrialLabel =
    schedule.summary.timeTrial === null
      ? "미정"
      : `${
          schedule.summary.timeTrial.initialSessionNumber === 1 ? "1회차" : "2회차"
        } · ${timeTrialProtocolLabel(schedule.summary.timeTrial.protocol)}`
  return {
    programName: schedule.program.title,
    dateRangeLabel: formatDateRange(schedule.program.startsOn, schedule.program.endsOn),
    timeTrialLabel,
    summary: {
      totalSessions: schedule.summary.totalSessions,
      upcomingCount: schedule.summary.upcomingCount,
      pastCount: schedule.summary.pastCount,
    },
    sessions: schedule.sessions.map(adminScheduleSessionRow),
  }
}

function adminSettingsDeletionRequestRow(
  request: PilotAdminSettings["deletionRequests"][number],
): AdminSettingsRow {
  const statusLabel =
    request.status === "requested"
      ? "요청됨"
      : request.status === "processing"
        ? "처리 중"
        : request.status === "completed"
          ? "완료"
          : "취소됨"
  const statusTone: AdminSettingsRow["statusTone"] =
    request.status === "requested" ? "warning" : "neutral"
  return {
    id: `deletion:${request.deletionRequestId}`,
    displayName: request.displayName,
    statusLabel,
    statusTone,
    requestedAtLabel: timeAgoLabel(request.requestedAt),
  }
}

function adminSettingsFailedNotificationRow(
  outbox: PilotAdminSettings["failedNotifications"][number],
): AdminFailedNotificationRow {
  const channelLabel = outbox.channel === "in_app" ? "앱" : "푸시"
  const statusLabel = outbox.status === "failed" ? "실패" : "대기"
  const statusTone: AdminFailedNotificationRow["statusTone"] =
    outbox.status === "failed" ? "critical" : "warning"
  return {
    id: `outbox:${outbox.outboxId}`,
    title: outbox.title,
    channelLabel,
    statusLabel,
    statusTone,
    attemptCount: outbox.attemptCount,
    errorCodeLabel: outbox.lastErrorCode === null ? "—" : outbox.lastErrorCode,
    createdAtLabel: timeAgoLabel(outbox.createdAt),
  }
}

export function buildAdminSettingsModel(settings: PilotAdminSettings): AdminSettingsViewModel {
  const timeTrialLabel =
    settings.timeTrial === null
      ? "미정"
      : `${
          settings.timeTrial.initialSessionNumber === 1 ? "1회차" : "2회차"
        } · ${timeTrialProtocolLabel(settings.timeTrial.protocol)}`
  const statusLabel =
    settings.program.status === "active"
      ? "정상 운영"
      : settings.program.status === "completed"
        ? "운영 종료"
        : settings.program.status === "archived"
          ? "보관됨"
          : "준비 중"
  return {
    programName: settings.program.title,
    dateRangeLabel: formatDateRange(settings.program.startsOn, settings.program.endsOn),
    timeTrialLabel,
    statusLabel,
    summary: {
      deletionRequestCount: settings.summary.deletionRequestCount,
      failedNotificationCount: settings.summary.failedNotificationCount,
    },
    deletionRequests: settings.deletionRequests.map(adminSettingsDeletionRequestRow),
    failedNotifications: settings.failedNotifications.map(adminSettingsFailedNotificationRow),
  }
}

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

function adminReportStatusTone(
  status: PilotAdminReport["snapshots"][number]["status"],
): "success" | "warning" | "neutral" {
  switch (status) {
    case "released":
      return "success"
    case "frozen":
      return "warning"
    case "draft":
    case "superseded":
      return "neutral"
  }
}

function adminReportStatusLabel(status: PilotAdminReport["snapshots"][number]["status"]): string {
  switch (status) {
    case "released":
      return "발행됨"
    case "frozen":
      return "확정됨"
    case "draft":
      return "초안"
    case "superseded":
      return "대체됨"
  }
}

function adminReportCell(
  cell: PilotAdminReport["snapshots"][number]["cells"][number],
): AdminReportCell {
  return {
    id: `cell:${cell.rowKey}:${cell.columnKey}`,
    rowLabel: cell.rowKey,
    columnLabel: cell.columnKey,
    participantCountLabel: cell.participantCount === null ? "—" : `${cell.participantCount}명`,
    valueLabel: cell.numericValue === null ? "—" : String(cell.numericValue),
    suppressed: cell.suppressed,
  }
}

export function buildAdminReportsModel(report: PilotAdminReport): AdminReportsViewModel {
  return {
    programName: report.program.title,
    dateRangeLabel: formatDateRange(report.program.startsOn, report.program.endsOn),
    summary: {
      reportCount: report.summary.reportCount,
      releasedCount: report.summary.releasedCount,
    },
    snapshots: report.snapshots.map((snapshot) => ({
      id: `snapshot:${snapshot.snapshotId}`,
      statusLabel: adminReportStatusLabel(snapshot.status),
      statusTone: adminReportStatusTone(snapshot.status),
      generatedAtLabel: timeAgoLabel(snapshot.generatedAt),
      releasedAtLabel: snapshot.releasedAt === null ? "—" : timeAgoLabel(snapshot.releasedAt),
      cells: snapshot.cells.map(adminReportCell),
    })),
  }
}
