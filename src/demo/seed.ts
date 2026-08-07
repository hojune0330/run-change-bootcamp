import { DemoStateSchema } from "./state.ts"

export function createInitialDemoState() {
  return DemoStateSchema.parse({
    session: null,
    assignments: [
      {
        id: "assignment-easy-run",
        title: "편안한 달리기",
        summary: "20분 동안 대화 가능한 속도로 달려요.",
        dueDate: "2026-08-31",
        category: "running",
      },
    ],
    notices: [
      {
        id: "announcement-welcome",
        title: "첫 주는 천천히 시작해요",
        body: "통증이 생기면 멈추고 기록에서 코치에게 알려요.",
        pinned: true,
      },
    ],
    completions: [],
    posts: [
      {
        id: "post-doyun-morning-run",
        authorId: "participant-02",
        body: "아침 5K를 편안한 호흡으로 마쳤어요.",
        createdLabel: "오늘 오전 7:45",
        baseHeartCount: 4,
        heartedBy: [],
        comments: [],
      },
      {
        id: "post-yuna-recovery",
        authorId: "participant-05",
        body: "회복 조깅 뒤 스트레칭까지 완료했어요.",
        createdLabel: "어제 오후 6:40",
        baseHeartCount: 7,
        heartedBy: [],
        comments: [],
      },
    ],
    metrics: [],
    drafts: [],
    consentedParticipants: ["participant-02", "participant-05", "participant-08"],
    revokedParticipants: [],
    consentEvents: [
      {
        id: "audit-consent-seed-01",
        participantId: "participant-02",
        kind: "granted",
        label: "안정 시 심박수 코치 공유 허용",
      },
      {
        id: "audit-consent-seed-02",
        participantId: "participant-05",
        kind: "granted",
        label: "안정 시 심박수 코치 공유 허용",
      },
      {
        id: "audit-consent-seed-03",
        participantId: "participant-08",
        kind: "granted",
        label: "안정 시 심박수 코치 공유 허용",
      },
    ],
    activityLog: [],
    deliveredFeedback: [
      {
        id: "feedback-weekly-summary",
        participantId: "participant-01",
        source: "automated_summary",
        title: "이번 주 기록 요약",
        body: "완료 기록이 쌓이면 주간 흐름을 요약해요.",
      },
    ],
    feedbackQueue: [
      {
        id: "feedback:harin-pain",
        participantId: "participant-01",
        kind: "pain_risk",
        summary: "무릎 불편 응답으로 코치 확인이 필요합니다.",
        createdAtLabel: "20분 전",
      },
      {
        id: "feedback:doyun-recovery",
        participantId: "participant-02",
        kind: "low_risk",
        summary: "수분 섭취와 가벼운 스트레칭을 안내합니다.",
        createdAtLabel: "10분 전",
      },
    ],
    coachQuery: "",
    coachCohortId: "all",
    selectedParticipantId: null,
    assignmentDraft: {
      title: "회복 조깅 30분",
      category: "running",
      dueDate: "2026-09-02",
      cohortId: "all",
      instructions: "대화 가능한 강도로 달린 뒤 체감 강도를 기록합니다.",
    },
    noticeDraft: {
      title: "토요일 집결 안내",
      body: "오전 8시까지 여의도 공원 입구에 모입니다.",
      pinned: true,
    },
    timeTrialDecision: { kind: "undecided" },
    timeTrialDraft: { session: null, protocol: null },
    timeTrialConfirmation: "idle",
    sequence: 1,
  })
}
