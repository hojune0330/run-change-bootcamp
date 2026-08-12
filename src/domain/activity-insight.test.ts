import { describe, expect, it } from "vitest"
import { ACTIVITY_INSIGHT_TEMPLATES, buildWeeklyActivityInsight } from "./activity-insight"

const participantId = "membership-participant-01"
const programId = "program-plus-run-2026"
const weekStart = "2026-08-24"

const acceptedRecord = {
  programId,
  participantId,
  format: "fit",
  observedAt: "2026-08-25T07:30:00+09:00",
  sourceFamily: "garmin",
  sourceModel: "forerunner",
  timezone: "Asia/Seoul",
  qualityFlags: ["device_reported"],
  metrics: {
    distanceM: 5_000,
    durationS: 1_800,
    averageHeartRateBpm: 150,
    steps: 6_200,
  },
  id: "import-artifact-accepted-01",
  parserName: "plus_run_fit_adapter",
  parserVersion: "1",
  acceptedBy: participantId,
  acceptedAt: "2026-08-25T07:35:00+09:00",
  serverDuplicateHmac: "c".repeat(64),
} as const

const insightRequest = {
  programId,
  participantId,
  weekStart,
  asOf: "2026-08-30T12:00:00+09:00",
  records: [acceptedRecord],
} as const

describe("deterministic weekly activity insight", () => {
  it("summarizes the Seoul week and keeps structured provenance", () => {
    const result = buildWeeklyActivityInsight(insightRequest)

    expect(result).toMatchObject({
      kind: "weekly_activity_insight",
      period: {
        start: "2026-08-24",
        endExclusive: "2026-08-31",
        timezone: "Asia/Seoul",
      },
      status: "partial",
      isPartialWeek: true,
      aggregates: {
        distanceM: 5_000,
        durationS: 1_800,
        steps: 6_200,
        paceSecondsPerKm: 360,
        activityDays: 1,
        averageHeartRateBpm: 150,
      },
      provenance: [
        {
          recordId: "import-artifact-accepted-01",
          parserName: "plus_run_fit_adapter",
          parserVersion: "1",
          sourceFamily: "garmin",
          sourceModel: "forerunner",
        },
      ],
      templateKey: "one_day",
      content: {
        category: "activity_summary",
        variant: "one_day",
      },
    })
  })

  it("excludes the next Monday at the exclusive boundary", () => {
    const result = buildWeeklyActivityInsight({
      ...insightRequest,
      records: [
        acceptedRecord,
        {
          ...acceptedRecord,
          id: "import-artifact-next-week",
          observedAt: "2026-08-31T00:00:00+09:00",
          serverDuplicateHmac: "d".repeat(64),
        },
      ],
    })

    expect(result?.provenance.map((source) => source.recordId)).toEqual([
      "import-artifact-accepted-01",
    ])
  })

  it("includes Seoul Sunday 23:59:59 and excludes Seoul Monday 00:00", () => {
    const sunday = {
      ...acceptedRecord,
      id: "import-artifact-sunday-boundary",
      observedAt: "2026-08-30T23:59:59+09:00",
      serverDuplicateHmac: "d".repeat(64),
    }
    const monday = {
      ...acceptedRecord,
      id: "import-artifact-monday-boundary",
      observedAt: "2026-08-31T00:00:00+09:00",
      serverDuplicateHmac: "e".repeat(64),
    }

    const result = buildWeeklyActivityInsight({
      ...insightRequest,
      records: [sunday, monday],
    })

    expect(result?.activityDates).toEqual(["2026-08-30"])
    expect(result?.provenance.map((source) => source.recordId)).toEqual([
      "import-artifact-sunday-boundary",
    ])
  })

  it("sums metrics, weights heart rate by duration, and marks a completed full week", () => {
    const result = buildWeeklyActivityInsight({
      ...insightRequest,
      asOf: "2026-08-31T00:00:00+09:00",
      records: [
        acceptedRecord,
        {
          ...acceptedRecord,
          id: "import-artifact-second-day",
          observedAt: "2026-08-30T23:59:59+09:00",
          metrics: {
            distanceM: 3_000,
            durationS: 1_200,
            averageHeartRateBpm: 120,
            steps: 3_000,
          },
          serverDuplicateHmac: "d".repeat(64),
        },
        {
          ...acceptedRecord,
          id: "import-artifact-heart-rate-only",
          observedAt: "2026-08-26T07:30:00+09:00",
          metrics: { averageHeartRateBpm: 200 },
          serverDuplicateHmac: "e".repeat(64),
        },
      ],
    })

    expect(result).toMatchObject({
      status: "complete",
      isPartialWeek: false,
      aggregates: {
        distanceM: 8_000,
        durationS: 3_000,
        steps: 9_200,
        paceSecondsPerKm: 375,
        activityDays: 3,
        averageHeartRateBpm: 138,
      },
      templateKey: "multiple_days",
    })
    expect(result?.content).toMatchObject({
      category: "activity_summary",
      variant: "multiple_days",
    })
  })

  it("exposes fixed activity-summary template variants", () => {
    expect(Object.keys(ACTIVITY_INSIGHT_TEMPLATES)).toEqual(["one_day", "multiple_days"])
    expect(
      Object.values(ACTIVITY_INSIGHT_TEMPLATES).map(({ category, variant }) => ({
        category,
        variant,
      })),
    ).toEqual([
      { category: "activity_summary", variant: "one_day" },
      { category: "activity_summary", variant: "multiple_days" },
    ])
  })

  it("returns no insight when the week has no accepted rows", () => {
    expect(buildWeeklyActivityInsight({ ...insightRequest, records: [] })).toBeNull()
  })

  it("leaves pace absent when either aggregate input is missing", () => {
    const result = buildWeeklyActivityInsight({
      ...insightRequest,
      records: [
        {
          ...acceptedRecord,
          metrics: { distanceM: 5_000 },
          serverDuplicateHmac: "d".repeat(64),
        },
      ],
    })

    expect(result?.aggregates.paceSecondsPerKm).toBeNull()
  })

  it("rejects duplicate, foreign, pending, and invalid records", () => {
    const duplicateIdRecord = {
      ...acceptedRecord,
      serverDuplicateHmac: "d".repeat(64),
    }
    expect(() =>
      buildWeeklyActivityInsight({
        ...insightRequest,
        records: [acceptedRecord, duplicateIdRecord],
      }),
    ).toThrow()
    expect(() =>
      buildWeeklyActivityInsight({
        ...insightRequest,
        records: [{ ...acceptedRecord, participantId: "membership-foreign-01" }],
      }),
    ).toThrow()
    expect(() =>
      buildWeeklyActivityInsight({
        ...insightRequest,
        records: [
          {
            ...acceptedRecord,
            id: "import-artifact-foreign-program",
            programId: "program-foreign-2026",
            serverDuplicateHmac: "e".repeat(64),
          },
        ],
      }),
    ).toThrow()
    expect(() =>
      buildWeeklyActivityInsight({
        ...insightRequest,
        records: [{ ...acceptedRecord, status: "pending_review" }],
      }),
    ).toThrow()
    expect(() =>
      buildWeeklyActivityInsight({
        ...insightRequest,
        records: [{ ...acceptedRecord, metrics: { averageHeartRateBpm: 251 } }],
      }),
    ).toThrow()
    expect(() =>
      buildWeeklyActivityInsight({
        ...insightRequest,
        weekStart: "2026-08-23",
      }),
    ).toThrow()
    expect(() =>
      buildWeeklyActivityInsight({
        ...insightRequest,
        records: [{ ...acceptedRecord, qualityFlags: ["duplicate_suspected"] }],
      }),
    ).toThrow()
  })
})
