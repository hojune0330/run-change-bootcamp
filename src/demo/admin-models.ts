import type {
  AdminMembersViewModel,
  AdminReportsViewModel,
  AdminScheduleViewModel,
  AdminSettingsViewModel,
} from "../features/admin/index.ts"
import { DEMO_PARTICIPANTS } from "../fixtures/index.ts"
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
    dateRangeLabel: "2026.08.24 — 10.24",
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

function timeTrialLabelFor(state: DemoState): string {
  return state.timeTrialDecision.kind === "decided"
    ? `${state.timeTrialDecision.session === "session_1" ? "1회차" : "2회차"} · ${
        state.timeTrialDecision.protocol === "12_minute"
          ? "12분"
          : state.timeTrialDecision.protocol === "3k"
            ? "3K"
            : "5K"
      }`
    : "미정"
}

const DEMO_DATE_RANGE_LABEL = "2026.08.24 — 10.24"

export function adminMembersModel(state: DemoState, programName: string): AdminMembersViewModel {
  return {
    programName,
    dateRangeLabel: DEMO_DATE_RANGE_LABEL,
    summary: {
      totalMembers: DEMO_PARTICIPANTS.length + 2,
      activeParticipants: DEMO_PARTICIPANTS.length,
      activeCoaches: 1,
      consentedCount: state.consentedParticipants.length,
    },
    members: [
      {
        id: "member:demo-admin",
        name: "운영 관리자",
        email: null,
        role: "admin",
        roleLabel: "관리자",
        status: "active",
        statusLabel: "활동 중",
        joinedAtLabel: "8월 10일",
        completionPercent: 0,
        progressLabel: "운영",
        shareLabel: "해당 없음",
        shareTone: "neutral",
      },
      {
        id: "member:demo-coach",
        name: "담당 코치",
        email: null,
        role: "coach",
        roleLabel: "코치",
        status: "active",
        statusLabel: "활동 중",
        joinedAtLabel: "8월 10일",
        completionPercent: 0,
        progressLabel: "운영",
        shareLabel: "해당 없음",
        shareTone: "neutral",
      },
      ...DEMO_PARTICIPANTS.map((member) => ({
        id: `member:${member.id}`,
        name: member.displayName,
        email: null,
        role: "participant" as const,
        roleLabel: "참여자",
        status: "active" as const,
        statusLabel: "활동 중",
        joinedAtLabel: "8월 24일",
        completionPercent: member.completionPercent,
        progressLabel: progressLabel(member.completionPercent),
        shareLabel: state.consentedParticipants.includes(member.id) ? "공유 중" : "기본 비공개",
        shareTone: state.consentedParticipants.includes(member.id)
          ? ("success" as const)
          : ("neutral" as const),
      })),
    ],
  }
}

const DEMO_SESSION_PLAN = [
  { number: 1, kindLabel: "온보딩", title: "오리엔테이션과 적응 세션", dateLabel: "8월 24일" },
  { number: 2, kindLabel: "이지런", title: "편안한 달리기 20분", dateLabel: "8월 27일" },
  { number: 3, kindLabel: "테크닉", title: "러닝 자세와 케이던스", dateLabel: "8월 31일" },
  { number: 4, kindLabel: "이지런", title: "대화 가능한 속도 30분", dateLabel: "9월 3일" },
  { number: 5, kindLabel: "회복", title: "회복 조깅과 스트레칭", dateLabel: "9월 7일" },
  { number: 6, kindLabel: "훈련", title: "인터벌 기초", dateLabel: "9월 10일" },
  { number: 7, kindLabel: "훈련", title: "언덕 반복 훈련", dateLabel: "9월 14일" },
  { number: 8, kindLabel: "이지런", title: "긴 이지런 40분", dateLabel: "9월 17일" },
  { number: 9, kindLabel: "훈련", title: "템포 러닝", dateLabel: "9월 21일" },
  { number: 10, kindLabel: "회복", title: "회복 주간 세션", dateLabel: "9월 24일" },
  { number: 11, kindLabel: "훈련", title: "페이스 감각 훈련", dateLabel: "9월 28일" },
  { number: 12, kindLabel: "이지런", title: "이지런과 보강 운동", dateLabel: "10월 1일" },
  { number: 13, kindLabel: "훈련", title: "목표 페이스 리허설", dateLabel: "10월 5일" },
  { number: 14, kindLabel: "회복", title: "가벼운 회복 세션", dateLabel: "10월 8일" },
  { number: 15, kindLabel: "테크닉", title: "재측정 준비 점검", dateLabel: "10월 12일" },
  { number: 16, kindLabel: "재측정", title: "8주차 기록 재측정", dateLabel: "10월 15일" },
] as const

export function adminScheduleModel(state: DemoState, programName: string): AdminScheduleViewModel {
  return {
    programName,
    dateRangeLabel: DEMO_DATE_RANGE_LABEL,
    timeTrialLabel: timeTrialLabelFor(state),
    summary: {
      totalSessions: DEMO_SESSION_PLAN.length,
      upcomingCount: DEMO_SESSION_PLAN.length - 3,
      pastCount: 3,
    },
    sessions: DEMO_SESSION_PLAN.map((session) => ({
      id: `session:demo-${session.number}`,
      sessionNumber: session.number,
      kindLabel: session.kindLabel,
      title: session.title,
      scheduledAtLabel: session.dateLabel,
    })),
  }
}

export function adminSettingsModel(state: DemoState, programName: string): AdminSettingsViewModel {
  return {
    programName,
    dateRangeLabel: DEMO_DATE_RANGE_LABEL,
    timeTrialLabel: timeTrialLabelFor(state),
    statusLabel: "정상 운영",
    summary: {
      deletionRequestCount: 0,
      failedNotificationCount: 0,
    },
    deletionRequests: [],
    failedNotifications: [],
  }
}

export function adminReportsModel(state: DemoState, programName: string): AdminReportsViewModel {
  const consentedCount = state.consentedParticipants.length
  return {
    programName,
    dateRangeLabel: DEMO_DATE_RANGE_LABEL,
    summary: {
      reportCount: 1,
      releasedCount: 0,
    },
    snapshots: [
      {
        id: "snapshot:demo-week-1",
        statusLabel: "초안",
        statusTone: "neutral",
        generatedAtLabel: "8월 31일",
        releasedAtLabel: "—",
        cells: [
          {
            id: "cell:completion:week-1",
            rowLabel: "과제 완료율",
            columnLabel: "1주차",
            participantCountLabel: `${DEMO_PARTICIPANTS.length}명`,
            valueLabel: "72%",
            suppressed: false,
          },
          {
            id: "cell:attendance:week-1",
            rowLabel: "세션 출석",
            columnLabel: "1주차",
            participantCountLabel: `${DEMO_PARTICIPANTS.length}명`,
            valueLabel: "18명",
            suppressed: false,
          },
          {
            id: "cell:heart-rate:week-1",
            rowLabel: "평균 안정 심박",
            columnLabel: "1주차",
            participantCountLabel: `${consentedCount}명`,
            valueLabel: "—",
            suppressed: consentedCount < 5,
          },
        ],
      },
    ],
  }
}
