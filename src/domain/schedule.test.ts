import { describe, expect, it } from "vitest"
import {
  buildNineWeekSchedule,
  TimeTrialDecisionSchema,
  UndecidedTimeTrialSchema,
} from "./schedule"

describe("buildNineWeekSchedule", () => {
  it("Given no coach decision, When the schedule is built, Then both early sessions remain candidates", () => {
    const decision = UndecidedTimeTrialSchema.parse({ status: "undecided" })

    const schedule = buildNineWeekSchedule({ startsOn: "2026-08-24", decision })

    expect(schedule).toHaveLength(18)
    expect(schedule.map((session) => session.week)).toEqual([
      1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9,
    ])
    expect(schedule[0]).toMatchObject({
      kind: "initial_time_trial_candidate",
      scheduledOn: "2026-08-25",
      session: 1,
    })
    expect(schedule[1]).toMatchObject({
      kind: "initial_time_trial_candidate",
      scheduledOn: "2026-08-27",
      session: 2,
    })
    expect(schedule[15]).toMatchObject({
      kind: "time_trial_retest_pending",
      scheduledOn: "2026-10-15",
    })
    expect(schedule[17]?.scheduledOn).toBe("2026-10-22")
  })

  it("Given session 1 and 3K, When built, Then session 2 recovers and week 8 retests 3K", () => {
    const decision = TimeTrialDecisionSchema.parse({
      status: "decided",
      session: 1,
      protocol: "3k",
      decidedAt: "2026-08-20T09:00:00+09:00",
      decidedBy: "membership-coach",
    })

    const schedule = buildNineWeekSchedule({ startsOn: "2026-08-24", decision })

    expect(schedule[0]).toMatchObject({
      kind: "initial_time_trial",
      protocol: "3k",
      session: 1,
    })
    expect(schedule[1]).toMatchObject({ kind: "recovery_technique", session: 2 })
    expect(schedule[15]).toMatchObject({ kind: "time_trial_retest", protocol: "3k" })
  })

  it("Given session 2 and 12 minutes, When built, Then session 1 stays easy and retest matches", () => {
    const decision = TimeTrialDecisionSchema.parse({
      status: "decided",
      session: 2,
      protocol: "12-minute",
      decidedAt: "2026-08-20T09:00:00Z",
      decidedBy: "membership-coach",
    })

    const schedule = buildNineWeekSchedule({ startsOn: "2026-08-24", decision })

    expect(schedule[0]).toMatchObject({ kind: "onboarding_easy", session: 1 })
    expect(schedule[1]).toMatchObject({
      kind: "initial_time_trial",
      protocol: "12-minute",
      session: 2,
    })
    expect(schedule[15]).toMatchObject({
      kind: "time_trial_retest",
      protocol: "12-minute",
    })
  })

  it("Given a changed decision, When rebuilt, Then no former protocol or session role leaks", () => {
    const first = TimeTrialDecisionSchema.parse({
      status: "decided",
      session: 1,
      protocol: "3k",
      decidedAt: "2026-08-20T09:00:00Z",
      decidedBy: "membership-coach",
    })
    const changed = TimeTrialDecisionSchema.parse({
      status: "decided",
      session: 2,
      protocol: "5k",
      decidedAt: "2026-08-21T09:00:00Z",
      decidedBy: "membership-coach",
    })

    const firstSchedule = buildNineWeekSchedule({ startsOn: "2026-08-24", decision: first })
    const changedSchedule = buildNineWeekSchedule({
      startsOn: "2026-08-24",
      decision: changed,
    })

    expect(firstSchedule[0]).toMatchObject({ kind: "initial_time_trial", protocol: "3k" })
    expect(changedSchedule[0]).toMatchObject({ kind: "onboarding_easy" })
    expect(changedSchedule[1]).toMatchObject({ kind: "initial_time_trial", protocol: "5k" })
    expect(changedSchedule[15]).toMatchObject({ kind: "time_trial_retest", protocol: "5k" })
  })

  it("rejects impossible dates, protocols, and session numbers at the boundary", () => {
    expect(
      TimeTrialDecisionSchema.safeParse({
        status: "decided",
        session: 3,
        protocol: "10k",
        decidedAt: "not-a-date",
        decidedBy: "membership-coach",
      }).success,
    ).toBe(false)
    expect(() =>
      buildNineWeekSchedule({
        startsOn: "2026-02-30",
        decision: UndecidedTimeTrialSchema.parse({ status: "undecided" }),
      }),
    ).toThrow()
  })
})
