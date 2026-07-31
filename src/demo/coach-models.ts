import { BOOTCAMP_SEED } from "../data/index.ts"
import type {
  CoachDashboardViewModel,
  ParticipantDetailViewModel,
  ParticipantId,
  ParticipantStatusViewModel,
} from "../features/coach/index.ts"
import { DEMO_PARTICIPANTS } from "../fixtures/index.ts"
import type { DemoParticipantId, DemoState } from "./state.ts"

export const DEMO_COHORT_OPTIONS = [{ id: "cohort:run-change", label: "RUN CHANGE 20명" }] as const

export function coachParticipantId(id: DemoParticipantId): ParticipantId {
  return `participant:${id}`
}

export function demoParticipantId(id: ParticipantId): DemoParticipantId | null {
  const participant = DEMO_PARTICIPANTS.find((item) => coachParticipantId(item.id) === id)
  return participant?.id ?? null
}

function missingHomeworkCount(state: DemoState, participantId: DemoParticipantId): number {
  const latest = state.assignments.at(-1)
  if (latest === undefined) return 0
  return state.completions.some(
    (item) => item.participantId === participantId && item.assignmentId === latest.id,
  )
    ? 0
    : 1
}

function participantStatus(
  state: DemoState,
  member: (typeof DEMO_PARTICIPANTS)[number],
): ParticipantStatusViewModel {
  const pending = state.feedbackQueue.filter((item) => item.participantId === member.id)
  const risk = pending.some((item) => item.kind === "pain_risk") ? "pain" : "none"
  return {
    id: coachParticipantId(member.id),
    name: member.displayName,
    cohortLabel: "RUN CHANGE",
    missingHomeworkCount: missingHomeworkCount(state, member.id),
    dataFreshnessLabel: "latestCheckInAt" in member ? "3일 이내" : "기록 없음",
    isDataStale: !("latestCheckInAt" in member),
    risk,
    pendingFeedbackCount: pending.length,
    change:
      member.completionPercent >= 60
        ? { kind: "improved", label: "과정 완료율", value: `${member.completionPercent}%` }
        : { kind: "steady", label: "과정 완료율", value: `${member.completionPercent}%` },
  }
}

function participantDetail(
  state: DemoState,
  participantId: DemoParticipantId,
): ParticipantDetailViewModel | undefined {
  const member = DEMO_PARTICIPANTS.find((item) => item.id === participantId)
  if (member === undefined) return undefined
  const healthMetric = BOOTCAMP_SEED.healthMetrics.find(
    (metric) => metric.participantId === `membership-${participantId}`,
  )
  const shared = state.consentedParticipants.includes(participantId)
  const revoked = state.revokedParticipants.includes(participantId)
  return {
    id: coachParticipantId(participantId),
    name: member.displayName,
    cohortLabel: "RUN CHANGE",
    contactLabel: `${member.displayName} · 데모 연락처`,
    coachNote: "공개된 과제 상태와 항목별 동의 정보만 확인합니다.",
    stakeholderMetrics: [
      shared && healthMetric !== undefined
        ? {
            id: "metric:resting-heart-rate",
            kind: "shared",
            label: "안정 시 심박수",
            value: `${healthMetric.value} bpm`,
            audienceLabel: "코치",
            updatedLabel: "8월 24일",
          }
        : {
            id: "metric:resting-heart-rate",
            kind: "private",
            reason: revoked ? "revoked" : "not_granted",
            label: "안정 시 심박수",
            audienceLabel: "코치",
            updatedLabel: revoked ? "최근 철회" : "공유 전",
          },
    ],
    auditEvents: state.consentEvents
      .filter((event) => event.participantId === participantId)
      .map((event) => ({
        id: `audit:${event.id}`,
        kind: event.kind === "granted" ? "consent_granted" : "consent_revoked",
        title: event.kind === "granted" ? "건강 항목 공유 허용" : "건강 항목 공유 철회",
        detail: event.label,
        occurredAtLabel: "8월 31일",
      })),
  }
}

export function coachModel(state: DemoState): CoachDashboardViewModel {
  const query = state.coachQuery.trim().toLocaleLowerCase("ko-KR")
  const allStatuses = DEMO_PARTICIPANTS.map((member) => participantStatus(state, member))
  const participants = allStatuses.filter(
    (item) => query.length === 0 || item.name.toLocaleLowerCase("ko-KR").includes(query),
  )
  const selected =
    state.selectedParticipantId === null
      ? undefined
      : participantDetail(state, state.selectedParticipantId)
  return {
    programName: "RUN CHANGE 2026",
    dateRangeLabel: "2026.08.24 — 10.24",
    summary: {
      totalParticipants: allStatuses.length,
      missingHomeworkCount: allStatuses.reduce(
        (total, item) => total + item.missingHomeworkCount,
        0,
      ),
      staleDataCount: allStatuses.filter((item) => item.isDataStale).length,
      painRiskCount: allStatuses.filter((item) => item.risk !== "none").length,
      pendingFeedbackCount: state.feedbackQueue.length,
    },
    filters: {
      query: state.coachQuery,
      cohortId: state.coachCohortId,
      cohortOptions: DEMO_COHORT_OPTIONS,
      resultCount: participants.length,
    },
    participants,
    ...(selected === undefined ? {} : { selectedParticipant: selected }),
    cohortOptions: DEMO_COHORT_OPTIONS,
    assignmentDraft: state.assignmentDraft,
    noticeDraft: state.noticeDraft,
    feedbackItems: state.feedbackQueue.map((item) => ({
      id: item.id,
      participantName:
        DEMO_PARTICIPANTS.find((member) => member.id === item.participantId)?.displayName ??
        "참여자",
      kind: item.kind,
      summary: item.summary,
      createdAtLabel: item.createdAtLabel,
    })),
    timeTrial: {
      currentDecision: state.timeTrialDecision,
      draft: state.timeTrialDraft,
      confirmation: { kind: state.timeTrialConfirmation },
    },
  }
}
