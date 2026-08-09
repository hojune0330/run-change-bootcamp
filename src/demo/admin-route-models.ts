import { formatKoreanDate } from "../app/program-clock.ts"
import { IsoDateSchema } from "../domain/values.ts"
import type {
  AdminMembersViewModel,
  AdminReportsViewModel,
  AdminScheduleViewModel,
  AdminSettingsViewModel,
} from "../features/admin/index.ts"
import { DEMO_PARTICIPANTS } from "../fixtures/index.ts"
import { DEMO_PROGRAM_CLOCK, DEMO_PROGRAM_DATE_RANGE_LABEL } from "./program-config.ts"
import type { DemoState } from "./state.ts"

function progressLabel(percent: number): string {
  if (percent >= 80) return "순조로움"
  if (percent >= 50) return "진행 중"
  return "시작 단계"
}

function timeTrialLabel(state: DemoState): string {
  if (state.timeTrialDecision.kind === "undecided") return "미정"
  const session = state.timeTrialDecision.session === "session_1" ? "1회차" : "2회차"
  const protocol =
    state.timeTrialDecision.protocol === "12_minute"
      ? "12분"
      : state.timeTrialDecision.protocol === "3k"
        ? "3K"
        : "5K"
  return `${session} · ${protocol}`
}

export function adminMembersModel(state: DemoState, programName: string): AdminMembersViewModel {
  return {
    programName,
    dateRangeLabel: DEMO_PROGRAM_DATE_RANGE_LABEL,
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
  [1, "온보딩", "오리엔테이션과 적응 세션", "2026-08-24"],
  [2, "이지런", "편안한 달리기 20분", "2026-08-27"],
  [3, "테크닉", "러닝 자세와 케이던스", "2026-08-31"],
  [4, "이지런", "대화 가능한 속도 30분", "2026-09-03"],
  [5, "회복", "회복 조깅과 스트레칭", "2026-09-07"],
  [6, "훈련", "인터벌 기초", "2026-09-10"],
  [7, "훈련", "언덕 반복 훈련", "2026-09-14"],
  [8, "이지런", "긴 이지런 40분", "2026-09-17"],
  [9, "훈련", "템포 러닝", "2026-09-21"],
  [10, "회복", "회복 주간 세션", "2026-09-24"],
  [11, "훈련", "페이스 감각 훈련", "2026-09-28"],
  [12, "이지런", "이지런과 보강 운동", "2026-10-01"],
  [13, "훈련", "목표 페이스 리허설", "2026-10-05"],
  [14, "회복", "가벼운 회복 세션", "2026-10-08"],
  [15, "테크닉", "재측정 준비 점검", "2026-10-12"],
  [16, "재측정", "8주차 기록 재측정", "2026-10-15"],
] as const

export function adminScheduleModel(state: DemoState, programName: string): AdminScheduleViewModel {
  const today = DEMO_PROGRAM_CLOCK.today()
  const pastCount = DEMO_SESSION_PLAN.filter(([, , , scheduledOn]) => scheduledOn <= today).length
  return {
    programName,
    dateRangeLabel: DEMO_PROGRAM_DATE_RANGE_LABEL,
    timeTrialLabel: timeTrialLabel(state),
    summary: {
      totalSessions: DEMO_SESSION_PLAN.length,
      upcomingCount: DEMO_SESSION_PLAN.length - pastCount,
      pastCount,
    },
    sessions: DEMO_SESSION_PLAN.map(([number, kindLabel, title, scheduledOn]) => ({
      id: `session:demo-${number}`,
      sessionNumber: number,
      kindLabel,
      title,
      scheduledAtLabel: formatKoreanDate(IsoDateSchema.parse(scheduledOn), "month_day"),
    })),
  }
}

export function adminSettingsModel(state: DemoState, programName: string): AdminSettingsViewModel {
  return {
    programName,
    dateRangeLabel: DEMO_PROGRAM_DATE_RANGE_LABEL,
    timeTrialLabel: timeTrialLabel(state),
    statusLabel: "정상 운영",
    summary: { deletionRequestCount: 0, failedNotificationCount: 0 },
    deletionRequests: [],
    failedNotifications: [],
  }
}

export function adminReportsModel(state: DemoState, programName: string): AdminReportsViewModel {
  const consentedCount = state.consentedParticipants.length
  return {
    programName,
    dateRangeLabel: DEMO_PROGRAM_DATE_RANGE_LABEL,
    summary: { reportCount: 1, releasedCount: 0 },
    snapshots: [
      {
        id: "snapshot:demo-week-1",
        statusLabel: "초안",
        statusTone: "neutral",
        generatedAtLabel: formatKoreanDate(DEMO_PROGRAM_CLOCK.today(), "month_day"),
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
