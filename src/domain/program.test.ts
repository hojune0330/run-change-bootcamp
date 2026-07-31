import { describe, expect, it } from "vitest"
import {
  MembershipSchema,
  OrganizationSchema,
  ProgramInstanceSchema,
  ProgramTemplateSchema,
} from "./program"

const ORGANIZATION = {
  id: "organization-hanwha",
  name: "Hanwha Life",
  createdAt: "2026-08-01T09:00:00+09:00",
}

const TEMPLATE = {
  id: "template-run-change",
  organizationId: "organization-hanwha",
  name: "RUN CHANGE",
  durationWeeks: 9,
  sessionsPerWeek: 2,
  supportedTimeTrials: ["12-minute", "3k", "5k"],
}

const INSTANCE = {
  id: "program-run-change-2026",
  organizationId: "organization-hanwha",
  templateId: "template-run-change",
  name: "RUN CHANGE 2026",
  startsOn: "2026-08-24",
  endsOn: "2026-10-24",
  cohortSize: 20,
  timeTrial: { status: "undecided" },
}

describe("program boundaries", () => {
  it("parses organization, fixed nine-week template, instance, and participant membership", () => {
    expect(OrganizationSchema.safeParse(ORGANIZATION).success).toBe(true)
    expect(ProgramTemplateSchema.safeParse(TEMPLATE).success).toBe(true)
    expect(ProgramInstanceSchema.safeParse(INSTANCE).success).toBe(true)
    expect(
      MembershipSchema.safeParse({
        id: "membership-participant-01",
        organizationId: "organization-hanwha",
        programId: "program-run-change-2026",
        userId: "user-participant-01",
        role: "participant",
        displayName: "Participant 01",
        cohortNumber: 1,
        joinedAt: "2026-08-01T09:00:00Z",
        active: true,
      }).success,
    ).toBe(true)
  })

  it("rejects a reversed program range, impossible date, or unsupported duration", () => {
    expect(ProgramInstanceSchema.safeParse({ ...INSTANCE, startsOn: "2026-02-30" }).success).toBe(
      false,
    )
    expect(
      ProgramInstanceSchema.safeParse({
        ...INSTANCE,
        startsOn: "2026-10-24",
        endsOn: "2026-08-24",
      }).success,
    ).toBe(false)
    expect(ProgramTemplateSchema.safeParse({ ...TEMPLATE, durationWeeks: 8 }).success).toBe(false)
  })

  it("requires participant-only cohort numbers between one and twenty", () => {
    const base = {
      id: "membership-coach",
      organizationId: "organization-hanwha",
      programId: "program-run-change-2026",
      userId: "user-coach",
      displayName: "Coach",
      joinedAt: "2026-08-01T09:00:00Z",
      active: true,
    }

    expect(MembershipSchema.safeParse({ ...base, role: "coach" }).success).toBe(true)
    expect(MembershipSchema.safeParse({ ...base, role: "coach", cohortNumber: 1 }).success).toBe(
      false,
    )
    expect(
      MembershipSchema.safeParse({ ...base, role: "participant", cohortNumber: 21 }).success,
    ).toBe(false)
  })
})
