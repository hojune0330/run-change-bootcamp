import type {
  AssignmentDraft,
  CoachFilterViewModel,
  CohortOption,
  NoticeDraft,
  ParticipantDetailViewModel,
  ParticipantStatusViewModel,
  PendingFeedback,
  TimeTrialViewModel,
} from "./types.ts"

export const COHORT_OPTIONS = [
  { id: "cohort:all-company", label: "한화생명 러닝 1기" },
  { id: "cohort:pace-a", label: "A 페이스" },
] satisfies readonly CohortOption[]

export const FILTER_MODEL = {
  query: "",
  cohortId: "all",
  cohortOptions: COHORT_OPTIONS,
  resultCount: 2,
} satisfies CoachFilterViewModel

export const PARTICIPANT_ROWS = [
  {
    id: "participant:minjeong",
    name: "김민정-이름이아주길어도레이아웃이깨지지않는참가자",
    cohortLabel: "A 페이스",
    missingHomeworkCount: 2,
    dataFreshnessLabel: "4일 전",
    isDataStale: true,
    risk: "pain",
    pendingFeedbackCount: 1,
    change: { kind: "declined", label: "주간 거리", value: "-12%" },
  },
  {
    id: "participant:jihoon",
    name: "박지훈",
    cohortLabel: "A 페이스",
    missingHomeworkCount: 0,
    dataFreshnessLabel: "오늘",
    isDataStale: false,
    risk: "none",
    pendingFeedbackCount: 0,
    change: { kind: "improved", label: "편안한 페이스", value: "+18초" },
  },
] satisfies readonly ParticipantStatusViewModel[]

export const PARTICIPANT_DETAIL = {
  id: "participant:minjeong",
  name: "김민정",
  cohortLabel: "A 페이스",
  contactLabel: "minjeong@example.test",
  coachNote: "오른쪽 무릎 불편감 확인 후 다음 러닝 강도를 결정합니다.",
  stakeholderMetrics: [
    {
      id: "metric:resting-heart-rate",
      kind: "shared",
      label: "안정 시 심박",
      value: "72 bpm",
      audienceLabel: "프로그램 담당자",
      updatedLabel: "7월 30일",
    },
    {
      id: "metric:pain-note",
      kind: "private",
      reason: "revoked",
      label: "통증 메모",
      audienceLabel: "프로그램 담당자",
      updatedLabel: "7월 31일",
    },
  ],
  auditEvents: [
    {
      id: "audit:revoked",
      kind: "consent_revoked",
      title: "통증 메모 공유 철회",
      detail: "프로그램 담당자 열람 권한이 종료되었습니다.",
      occurredAtLabel: "7월 31일 09:10",
    },
  ],
} satisfies ParticipantDetailViewModel

export const ASSIGNMENT_DRAFT = {
  title: "회복 조깅 30분",
  category: "running",
  dueDate: "2026-08-28",
  cohortId: "cohort:pace-a",
  instructions: "대화 가능한 강도로 달린 뒤 체감 강도를 기록합니다.",
} satisfies AssignmentDraft

export const NOTICE_DRAFT = {
  title: "토요일 집결 안내",
  body: "오전 8시까지 여의도 공원 입구에 모입니다.",
  pinned: true,
} satisfies NoticeDraft

export const FEEDBACK_ITEMS = [
  {
    id: "feedback:recovery-reminder",
    kind: "low_risk",
    participantName: "박지훈",
    summary: "수분 섭취와 가벼운 스트레칭을 안내합니다.",
    createdAtLabel: "10분 전",
  },
  {
    id: "feedback:pain-risk",
    kind: "pain_risk",
    participantName: "김민정",
    summary: "무릎 통증 응답으로 훈련 중단과 확인이 필요합니다.",
    createdAtLabel: "20분 전",
  },
] satisfies readonly PendingFeedback[]

export const UNDECIDED_TIME_TRIAL = {
  currentDecision: { kind: "undecided" },
  draft: { session: null, protocol: null },
  confirmation: { kind: "idle" },
} satisfies TimeTrialViewModel
