import { IsoDateSchema } from "../../domain/values.ts"
import type {
  AuditEventKind,
  AuditEventViewModel,
  ChangeIndicator,
  CoachDashboardViewModel,
  CohortOption,
  ParticipantDetailViewModel,
  ParticipantStatusViewModel,
  PendingFeedback,
  StakeholderMetric,
  TimeTrialDecision,
} from "../../features/coach/index.ts"
import type {
  PilotCoachAuditEvent,
  PilotCoachDashboard,
  PilotCoachParticipantDetail,
  PilotCoachSharedMetric,
} from "../../integrations/supabase/pilot-gateway.ts"
import { formatKoreanDate, formatKoreanProgramRange } from "../program-clock.ts"

export function formatMonthDay(iso: string): string {
  const parsed = IsoDateSchema.safeParse(iso.slice(0, 10))
  return parsed.success ? formatKoreanDate(parsed.data, "month_day") : "날짜 미정"
}

export function timeAgoLabel(iso: string | null): string {
  if (iso === null) return "기록 없음"
  const observed = new Date(iso)
  if (Number.isNaN(observed.getTime())) return formatMonthDay(iso)
  const elapsedDays = (Date.now() - observed.getTime()) / 86_400_000
  if (elapsedDays < 1) return "오늘"
  if (elapsedDays < 4) return `${Math.floor(elapsedDays)}일 전`
  if (elapsedDays < 8) return `${Math.floor(elapsedDays)}일 전`
  return formatMonthDay(iso)
}

function isDataStale(iso: string | null): boolean {
  if (iso === null) return true
  const observed = new Date(iso)
  if (Number.isNaN(observed.getTime())) return true
  return (Date.now() - observed.getTime()) / 86_400_000 > 7
}

function trendIndicator(count14d: number, countPrev14d: number): ChangeIndicator {
  if (count14d === 0 && countPrev14d === 0) {
    return { kind: "no_data", label: "최근 기록" }
  }
  const value = `${count14d}건`
  if (count14d > countPrev14d) {
    return { kind: "improved", label: "최근 14일 기록", value }
  }
  if (count14d < countPrev14d) {
    return { kind: "declined", label: "최근 14일 기록", value }
  }
  return { kind: "steady", label: "최근 14일 기록", value }
}

export function coachRosterParticipant(
  participant: PilotCoachDashboard["participants"][number],
): ParticipantStatusViewModel {
  return {
    id: `participant:${participant.profileId}`,
    name: participant.displayName,
    cohortLabel: "코호트 1",
    missingHomeworkCount: participant.missingHomeworkCount,
    dataFreshnessLabel: timeAgoLabel(participant.latestMetricAt),
    isDataStale: isDataStale(participant.latestMetricAt),
    risk: participant.risk,
    pendingFeedbackCount: participant.pendingFeedbackCount,
    change: trendIndicator(participant.metricCount14d, participant.metricCountPrev14d),
  }
}

export function coachFeedbackItem(
  item: PilotCoachDashboard["feedbackQueue"][number],
): PendingFeedback {
  const kind: PendingFeedback["kind"] =
    item.classification === "low_risk"
      ? "low_risk"
      : item.classification === "training_change"
        ? "training_change"
        : "pain_risk"
  return {
    id: `feedback:${item.feedbackId}`,
    participantName: item.participantName,
    summary: item.body,
    createdAtLabel: formatMonthDay(item.createdAt),
    kind,
  }
}

export function buildCoachDashboardModel(dashboard: PilotCoachDashboard): CoachDashboardViewModel {
  const cohort: CohortOption = {
    id: "cohort:pilot",
    label: `${dashboard.program.title} 전체`,
  }
  const timeTrialDecision: TimeTrialDecision =
    dashboard.timeTrial === null
      ? { kind: "undecided" }
      : {
          kind: "decided",
          session: dashboard.timeTrial.initialSessionNumber === 1 ? "session_1" : "session_2",
          protocol: dashboard.timeTrial.protocol,
        }
  return {
    programName: dashboard.program.title,
    dateRangeLabel: formatKoreanProgramRange(dashboard.program.startsOn, dashboard.program.endsOn),
    summary: {
      totalParticipants: dashboard.summary.totalParticipants,
      missingHomeworkCount: dashboard.summary.missingHomeworkCount,
      staleDataCount: dashboard.summary.staleDataCount,
      painRiskCount: dashboard.summary.painRiskCount,
      pendingFeedbackCount: dashboard.summary.pendingFeedbackCount,
    },
    filters: {
      query: "",
      cohortId: "all",
      cohortOptions: [cohort],
      resultCount: dashboard.participants.length,
    },
    participants: dashboard.participants.map(coachRosterParticipant),
    cohortOptions: [cohort],
    assignmentDraft: {
      title: "",
      category: "running",
      dueDate: "",
      cohortId: "all",
      instructions: "",
    },
    noticeDraft: { title: "", body: "", pinned: false },
    feedbackItems: dashboard.feedbackQueue.map(coachFeedbackItem),
    timeTrial: {
      currentDecision: timeTrialDecision,
      draft: { session: null, protocol: null },
      confirmation: { kind: "idle" },
    },
  }
}

export function metricLabel(metricType: string): string {
  switch (metricType) {
    case "distance_m":
      return "주행 거리"
    case "duration_s":
      return "러닝 시간"
    case "pace_s_per_km":
      return "페이스"
    case "heart_rate_bpm":
      return "심박수"
    case "weight_kg":
      return "체중"
    case "body_fat_pct":
      return "체지방률"
    case "pain_score":
      return "통증 점수"
    default:
      return "기타 건강"
  }
}

export function metricValue(metric: PilotCoachSharedMetric): string {
  switch (metric.metricType) {
    case "distance_m": {
      const kilometers = metric.value / 1000
      return `${kilometers.toFixed(kilometers >= 10 ? 1 : 2)} km`
    }
    case "duration_s": {
      const minutes = Math.floor(metric.value / 60)
      const seconds = Math.round(metric.value % 60)
      return seconds === 0 ? `${minutes}분` : `${minutes}분 ${seconds}초`
    }
    case "pace_s_per_km": {
      const minutes = Math.floor(metric.value / 60)
      const seconds = Math.round(metric.value % 60)
      return `${minutes}'${String(seconds).padStart(2, "0")}"/km`
    }
    case "sleep_hours":
      return `${metric.value.toFixed(1)}시간`
    default:
      return `${metric.value} ${metric.unit}`
  }
}

function auditViewModel(event: PilotCoachAuditEvent): AuditEventViewModel {
  let kind: AuditEventKind = "coach_feedback"
  let title = "코치 확인"
  switch (event.eventType) {
    case "consent.granted":
      kind = "consent_granted"
      title = "건강 항목 공유 허용"
      break
    case "consent.revoked":
      kind = "consent_revoked"
      title = "건강 항목 공유 철회"
      break
    case "feedback.approved":
      kind = "coach_feedback"
      title = "피드백 승인"
      break
    case "feedback.rejected":
      kind = "coach_feedback"
      title = "피드백 반려"
      break
  }
  const detail =
    typeof event.details === "object" && event.details !== null
      ? JSON.stringify(event.details)
      : event.eventType
  return {
    id: `audit:${event.entityId ?? event.occurredAt}`,
    kind,
    title,
    detail: detail === "{}" ? event.eventType : detail,
    occurredAtLabel: formatMonthDay(event.occurredAt),
  }
}

export function buildCoachParticipantDetailModel(
  detail: PilotCoachParticipantDetail,
): ParticipantDetailViewModel {
  const consented = new Set(detail.consentedMetricTypes)
  const sharedTypes = new Set(detail.sharedMetrics.map((metric) => metric.metricType))
  const shared: StakeholderMetric[] = detail.sharedMetrics.map((metric) => ({
    id: `metric:${metric.metricType}`,
    kind: "shared",
    label: metricLabel(metric.metricType),
    value: metricValue(metric),
    audienceLabel: "코치",
    updatedLabel: timeAgoLabel(metric.observedAt),
  }))
  const privateMetrics: StakeholderMetric[] = detail.healthMetricTypes
    .filter((metricType) => !consented.has(metricType) || !sharedTypes.has(metricType))
    .map<StakeholderMetric>((metricType) => ({
      id: `metric:${metricType}`,
      kind: "private",
      reason: consented.has(metricType) ? "revoked" : "not_granted",
      label: metricLabel(metricType),
      audienceLabel: "코치",
      updatedLabel: consented.has(metricType) ? "최근 철회" : "공유 전",
    }))
  return {
    id: `participant:${detail.profile.profileId}`,
    name: detail.profile.displayName,
    cohortLabel: "코호트 1",
    contactLabel: detail.profile.email ?? `${detail.profile.displayName} · 파일럿 계정`,
    coachNote: "동의된 건강 항목과 활동 기록만 확인합니다.",
    stakeholderMetrics: [...shared, ...privateMetrics],
    auditEvents: detail.auditEvents.map(auditViewModel),
  }
}
