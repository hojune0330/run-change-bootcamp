import { describe, expect, it } from "vitest"
import { AssessmentAttemptSchema, AssessmentSessionSchema } from "./assessment"
import fixture from "./fixtures/plus-run-reporting.json"
import { PLUS_RUN_2026_PROTOCOL } from "./plus-run-protocol"
import {
  AmbiguousOfficialAttemptError,
  calculateAdherence,
  calculateThreeKilometerChange,
  selectOfficialAttempt,
  summarizeCohort,
} from "./reporting"
import { calculateRestingHeartRateResult } from "./resting-heart-rate"
import { suppressAggregateCells } from "./suppression"

function cohortForChanges(changes: readonly number[]) {
  return changes.map((change, index) => ({
    enrollmentId: `threshold-${index}`,
    lifecycleStatus: "active",
    baselineSeconds: 1_000,
    retestSeconds: 1_000 - change * 10,
    adherence: { assignedWhileActiveCount: 10, acceptedLinkedSessionCount: 8 },
  }))
}

describe("PLUS Run measurement reporting", () => {
  it("Given the locked 2026 protocol, When the official baseline is parsed, Then its protocol version is explicit", () => {
    const officialBaseline = {
      id: "assessment-session-plus-run-baseline",
      programId: "program-plus-run-2026",
      protocolVersionId: "assessment-protocol-version-plus-run-2026-v1",
      purpose: "initial",
      week: 1,
      session: 1,
      scheduledOn: "2026-08-27",
      protocol: { kind: "3k" },
    } as const

    expect(AssessmentSessionSchema.safeParse(officialBaseline).success).toBe(true)
    const withoutVersion = { ...officialBaseline }
    Reflect.deleteProperty(withoutVersion, "protocolVersionId")
    expect(AssessmentSessionSchema.safeParse(withoutVersion).success).toBe(false)
  })

  it("Given the locked protocol, When boundaries are read, Then official and administrative dates stay separate", () => {
    expect(PLUS_RUN_2026_PROTOCOL).toMatchObject({
      scheduleAnchorOn: "2026-08-24",
      programStartOn: "2026-08-24",
      onboardingOn: "2026-08-25",
      officialBaselineOn: "2026-08-27",
      restingHeartRateComparison: { startOn: "2026-10-08", endOn: "2026-10-14" },
      interventionEndpointOn: "2026-10-15",
      officialRetestOn: "2026-10-15",
      administrativeEndOn: "2026-10-24",
      festivalOn: "2026-10-24",
    })
    expect(PLUS_RUN_2026_PROTOCOL.officialRetestOn).not.toBe(PLUS_RUN_2026_PROTOCOL.festivalOn)
  })

  it("Given faster, equal, and slower raw seconds, When change is calculated, Then only raw positive change improves", () => {
    expect(calculateThreeKilometerChange({ baselineSeconds: 1_000, retestSeconds: 900 })).toEqual({
      rawChangePercent: 10,
      improved: true,
    })
    expect(calculateThreeKilometerChange({ baselineSeconds: 1_000, retestSeconds: 1_000 })).toEqual(
      {
        rawChangePercent: 0,
        improved: false,
      },
    )
    expect(calculateThreeKilometerChange({ baselineSeconds: 1_000, retestSeconds: 1_020 })).toEqual(
      {
        rawChangePercent: -2,
        improved: false,
      },
    )
  })

  it("Given raw fractional changes, When summarized, Then raw precision is retained and display values round to one decimal", () => {
    const positive = summarizeCohort(cohortForChanges([1.25]))
    const negative = summarizeCohort(cohortForChanges([-1.25]))

    expect(positive.medianChangePercentRaw).toBe(1.25)
    expect(positive.medianChangePercentDisplay).toBe(1.3)
    expect(negative.medianChangePercentRaw).toBe(-1.25)
    expect(negative.medianChangePercentDisplay).toBe(-1.3)
  })

  it("Given attempt contracts, When technical invalidation metadata is parsed, Then only invalidated originals may carry it", () => {
    const invalidatedOriginal = {
      id: "assessment-attempt-original",
      assessmentSessionId: "assessment-session-baseline",
      protocolVersionId: "assessment-protocol-version-plus-run-2026-v1",
      enrollmentId: "enrollment-participant-01",
      attemptKind: "original",
      originalAttemptId: null,
      status: "invalidated",
      invalidationReason: "technical_interruption",
      elapsedSeconds: 1_000,
      recordedAt: "2026-08-27T08:00:00+09:00",
      conditions: {
        routeVersion: "route-v1",
        measuredDistanceMeters: 3_000,
        surfaceKey: "track",
        timingMethodKey: "chip",
        warmupProtocolKey: "warmup-v1",
        startedLocalTime: "08:00:00",
        timezone: "Asia/Seoul",
        sourceFamily: "official_timer",
        deviceFamily: "chip_timer",
      },
    } as const

    const parsed = AssessmentAttemptSchema.safeParse(invalidatedOriginal)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(Object.isFrozen(parsed.data)).toBe(true)
      expect(Object.isFrozen(parsed.data.conditions)).toBe(true)
    }
    expect(
      AssessmentAttemptSchema.safeParse({
        ...invalidatedOriginal,
        status: "accepted",
      }).success,
    ).toBe(false)
    expect(
      AssessmentAttemptSchema.safeParse({
        ...invalidatedOriginal,
        invalidationReason: null,
      }).success,
    ).toBe(false)
  })

  it("Given the 20-member golden cohort, When summarized, Then denominators and percentile_cont quartiles match", () => {
    const summary = summarizeCohort(fixture.cohort)

    expect(summary).toMatchObject({
      allEnrolledCount: 20,
      baselineCount: 16,
      retestCount: 16,
      validPairCount: 15,
      perProtocolCount: 12,
      withdrawnCount: 1,
      improvedCount: 13,
      q1ChangePercentRaw: 2.5,
      medianChangePercentRaw: 4,
      q3ChangePercentRaw: 5.5,
      q1ChangePercentDisplay: 2.5,
      medianChangePercentDisplay: 4,
      q3ChangePercentDisplay: 5.5,
      productPositive: true,
    })
    expect(summary.improvedPercentRaw).toBeCloseTo(86.666_666_666_7)
  })

  it("Given threshold boundary cohorts, When summarized, Then 15 pairs, 3 percent median, and 60 percent improved are all required", () => {
    const exact = [-1, -1, -1, -1, -1, -1, 3, 3, 3, 3, 3, 3, 3, 3, 3]

    expect(summarizeCohort(cohortForChanges(exact)).productPositive).toBe(true)
    expect(summarizeCohort(cohortForChanges(exact.slice(1))).productPositive).toBe(false)
    expect(
      summarizeCohort(
        cohortForChanges([-1, -1, -1, -1, -1, -1, 2.9, 2.9, 2.9, 2.9, 2.9, 2.9, 2.9, 2.9, 2.9]),
      ).productPositive,
    ).toBe(false)
    expect(
      summarizeCohort(cohortForChanges([0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3, 3]))
        .productPositive,
    ).toBe(false)
  })

  it("Given assigned active sessions, When adherence is calculated, Then exactly 80 percent is per-protocol", () => {
    expect(
      calculateAdherence({ assignedWhileActiveCount: 10, acceptedLinkedSessionCount: 8 }),
    ).toEqual({
      rawPercent: 80,
      perProtocol: true,
    })
    expect(
      calculateAdherence({ assignedWhileActiveCount: 10, acceptedLinkedSessionCount: 7 })
        .perProtocol,
    ).toBe(false)
    expect(
      calculateAdherence({ assignedWhileActiveCount: 0, acceptedLinkedSessionCount: 0 }),
    ).toEqual({
      rawPercent: null,
      perProtocol: false,
    })
  })

  it("Given a documented technical interruption, When attempts are selected, Then the single accepted reattempt replaces the original", () => {
    const original = {
      attemptId: "attempt-original",
      attemptKind: "original",
      originalAttemptId: null,
      status: "invalidated",
      invalidationReason: "technical_interruption",
      elapsedSeconds: 1_000,
      recordedAt: "2026-08-27T08:00:00+09:00",
    } as const
    const reattempt = {
      attemptId: "attempt-reattempt",
      attemptKind: "technical_reattempt",
      originalAttemptId: "attempt-original",
      status: "accepted",
      invalidationReason: null,
      elapsedSeconds: 950,
      recordedAt: "2026-08-30T08:00:00+09:00",
    } as const
    const selected = selectOfficialAttempt([original, reattempt])

    expect(selected?.attemptId).toBe("attempt-reattempt")
    expect(
      selectOfficialAttempt([original, { ...reattempt, recordedAt: "2026-08-27T07:59:59+09:00" }]),
    ).toBeNull()
    expect(
      selectOfficialAttempt([original, { ...reattempt, recordedAt: "2026-09-03T08:00:01+09:00" }]),
    ).toBeNull()
  })

  it("Given an accepted ordinary attempt or ambiguous attempts, When selected, Then best-of and duplicates are rejected", () => {
    const acceptedOriginal = {
      attemptId: "attempt-original",
      attemptKind: "original",
      originalAttemptId: null,
      status: "accepted",
      invalidationReason: null,
      elapsedSeconds: 1_000,
      recordedAt: "2026-08-27T08:00:00+09:00",
    }
    const ordinaryReattempt = {
      attemptId: "attempt-reattempt",
      attemptKind: "technical_reattempt",
      originalAttemptId: "attempt-original",
      status: "accepted",
      invalidationReason: null,
      elapsedSeconds: 900,
      recordedAt: "2026-08-28T08:00:00+09:00",
    }

    expect(selectOfficialAttempt([acceptedOriginal, ordinaryReattempt])?.attemptId).toBe(
      "attempt-original",
    )
    expect(() =>
      selectOfficialAttempt([
        acceptedOriginal,
        { ...acceptedOriginal, attemptId: "attempt-second" },
      ]),
    ).toThrow(AmbiguousOfficialAttemptError)
  })

  it("Given accepted morning readings, When RHR windows are calculated, Then daily medians precede window medians and negative change improves descriptively", () => {
    const result = calculateRestingHeartRateResult(fixture.restingHeartRate)

    expect(result).toEqual({
      status: "complete",
      baselineDistinctDays: 3,
      comparisonDistinctDays: 3,
      sourceFamily: "garmin",
      deviceFamily: "forerunner",
      baselineWindowMedianBpm: 61,
      comparisonWindowMedianBpm: 56,
      rawChangeBpm: -5,
      displayChangeBpm: -5,
      outcomeLabel: "exploratory",
    })
  })

  it("Given incomplete or changed-device RHR windows, When calculated, Then values are insufficient or mismatched and never imputed", () => {
    const incomplete = calculateRestingHeartRateResult([
      ...fixture.restingHeartRate.slice(0, 2),
      ...fixture.restingHeartRate.slice(4, 6),
    ])
    const missingComparison = calculateRestingHeartRateResult(
      fixture.restingHeartRate.filter((reading) => reading.localDate < "2026-10-08"),
    )
    const mismatched = calculateRestingHeartRateResult(
      fixture.restingHeartRate.map((reading) =>
        reading.localDate >= "2026-10-08" && reading.status === "accepted"
          ? { ...reading, sourceFamily: "apple", deviceFamily: "watch" }
          : reading,
      ),
    )

    expect(incomplete).toMatchObject({ status: "insufficient", rawChangeBpm: null })
    expect(missingComparison).toMatchObject({ status: "insufficient", rawChangeBpm: null })
    expect(mismatched).toMatchObject({
      status: "mismatched_device",
      baselineWindowMedianBpm: null,
      comparisonWindowMedianBpm: null,
      rawChangeBpm: null,
    })
  })

  it("Given an n-under-five cell, When complementary suppression runs, Then stable smallest row-column keys hide reconstruction", () => {
    const result = suppressAggregateCells(fixture.suppressionCells)
    const suppressed = result
      .filter((cell) => cell.suppressed)
      .map((cell) => `${cell.rowKey}:${cell.columnKey}:${cell.suppressionReason}`)

    expect(suppressed).toEqual([
      "group_a:stage_a:primary",
      "group_a:stage_b:complementary",
      "group_b:stage_a:complementary",
      "group_b:stage_b:complementary",
    ])
    expect(
      result.filter((cell) => cell.suppressed).every((cell) => cell.numericValue === null),
    ).toBe(true)
    expect(result.find((cell) => !cell.suppressed)?.numericValue).toBe(3)
  })
})
