import { describe, expect, it } from "vitest"
import { IsoDateSchema } from "../../domain/values.ts"
import type {
  PilotAdminMembers,
  PilotCoachDashboard,
  PilotParticipantToday,
} from "../../integrations/supabase/pilot-gateway.ts"
import { createFixedProgramClock, createSeoulProgramClock } from "../program-clock.ts"
import { buildAdminMembersModel } from "./pilot-admin-models.ts"
import { buildCoachDashboardModel } from "./pilot-coach-models.ts"
import { buildParticipantTodayModel } from "./pilot-participant-models.ts"

const PROGRAM_RANGE = {
  endsOn: "2026-10-24",
  startsOn: "2026-08-24",
  title: "PLUS Run 2026",
} as const

const PARTICIPANT_TODAY = {
  announcement: null,
  assignment: null,
  backlog: [],
  dateLabel: "ignored gateway label",
  profile: { displayName: "테스트 참가자", profileId: "participant-test" },
  program: { title: PROGRAM_RANGE.title },
  streakDays: 0,
} satisfies PilotParticipantToday

const COACH_DASHBOARD = {
  feedbackQueue: [],
  participants: [],
  program: PROGRAM_RANGE,
  summary: {
    missingHomeworkCount: 0,
    painRiskCount: 0,
    pendingFeedbackCount: 0,
    staleDataCount: 0,
    totalParticipants: 0,
  },
  timeTrial: null,
} satisfies PilotCoachDashboard

const ADMIN_MEMBERS = {
  members: [],
  program: { ...PROGRAM_RANGE, status: "active" },
  summary: {
    activeCoaches: 0,
    activeParticipants: 0,
    consentedCount: 0,
    totalMembers: 0,
  },
} satisfies PilotAdminMembers

describe("pilot model ProgramClock boundaries", () => {
  it("uses an injected participant clock instead of trusting a gateway date label", () => {
    const preview = buildParticipantTodayModel(
      PARTICIPANT_TODAY,
      createFixedProgramClock(IsoDateSchema.parse("2026-08-31")),
    )
    const live = buildParticipantTodayModel(
      PARTICIPANT_TODAY,
      createSeoulProgramClock(() => new Date("2026-08-09T15:30:00.000Z")),
    )

    expect(preview.dateLabel).toBe("8월 31일 월요일")
    expect(live.dateLabel).toBe("8월 10일 월요일")
  })

  it("shares the friendly, unbreakable range boundary across coach and admin models", () => {
    const expected = "2026년 8월 24일 – 10월 24일"

    expect(buildCoachDashboardModel(COACH_DASHBOARD).dateRangeLabel).toBe(expected)
    expect(buildAdminMembersModel(ADMIN_MEMBERS).dateRangeLabel).toBe(expected)
  })
})
