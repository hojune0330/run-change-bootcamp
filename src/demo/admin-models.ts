import { DEMO_PARTICIPANTS } from "../fixtures/index.ts"
import { DEMO_PROGRAM_DATE_RANGE_LABEL } from "./program-config.ts"
import type { ActivityAction, DemoState } from "./state.ts"

const ACTION_LABEL: Record<ActivityAction, string> = {
  assignment_publish: "과제 발행",
  notice_publish: "공지 발행",
  feedback_approve: "피드백 승인",
  feedback_reject: "피드백 반려",
  time_trial_save: "기록 측정 저장",
}

function actionTone(action: ActivityAction): "success" | "warning" | "danger" | "default" {
  switch (action) {
    case "feedback_reject":
      return "warning"
    case "feedback_approve":
    case "assignment_publish":
    case "notice_publish":
      return "success"
    case "time_trial_save":
      return "default"
  }
}

function actorLabel(actor: "coach" | "admin"): string {
  return actor === "admin" ? "관리자" : "코치"
}

function progressLabel(percent: number): string {
  if (percent >= 80) return "순조로움"
  if (percent >= 50) return "진행 중"
  return "시작 단계"
}

export function adminModel(state: DemoState) {
  const consentedCount = state.consentedParticipants.length
  const assignmentsCount = state.assignments.length
  const pendingFeedbackCount = state.feedbackQueue.length
  const riskCount = state.feedbackQueue.filter((item) => item.kind === "pain_risk").length
  const activity = [...state.activityLog].reverse().map((entry) => ({
    id: entry.id,
    actor: entry.actor,
    actorLabel: actorLabel(entry.actor),
    action: entry.action,
    actionLabel: ACTION_LABEL[entry.action],
    tone: actionTone(entry.action),
    summary: entry.summary,
    createdAtLabel: entry.createdAtLabel,
  }))
  const members = DEMO_PARTICIPANTS.map((member) => ({
    id: member.id,
    name: member.displayName,
    cohortLabel: "RUN CHANGE",
    completionPercent: member.completionPercent,
    progressLabel: progressLabel(member.completionPercent),
    shareLabel: state.consentedParticipants.includes(member.id) ? "공유 중" : "기본 비공개",
    shareTone: state.consentedParticipants.includes(member.id)
      ? ("success" as const)
      : ("neutral" as const),
  }))
  const timeTrialLabel =
    state.timeTrialDecision.kind === "decided"
      ? `${state.timeTrialDecision.session === "session_1" ? "1회차" : "2회차"} · ${
          state.timeTrialDecision.protocol === "12_minute"
            ? "12분"
            : state.timeTrialDecision.protocol === "3k"
              ? "3K"
              : "5K"
        }`
      : "미정"

  return {
    programName: "RUN CHANGE 2026",
    dateRangeLabel: DEMO_PROGRAM_DATE_RANGE_LABEL,
    operationStatusLabel: "정상 운영",
    timeTrialLabel,
    consentedCount,
    assignmentsCount,
    kpis: [
      {
        id: "members",
        label: "등록 멤버",
        value: `${DEMO_PARTICIPANTS.length}명`,
        hint: "전체 코호트",
      },
      { id: "consent", label: "건강 공유", value: `${consentedCount}명`, hint: "항목별 동의" },
      { id: "assignments", label: "발행 과제", value: `${assignmentsCount}건`, hint: "누적 발행" },
      {
        id: "feedback",
        label: "피드백 대기",
        value: `${pendingFeedbackCount}건`,
        hint: "승인 필요",
      },
      { id: "risk", label: "통증·위험", value: `${riskCount}건`, hint: "코치 확인" },
    ],
    activity,
    recentActivity: activity.slice(0, 6),
    actionOptions: (Object.keys(ACTION_LABEL) as ActivityAction[]).map((action) => ({
      value: action,
      label: ACTION_LABEL[action],
    })),
    members,
  }
}
