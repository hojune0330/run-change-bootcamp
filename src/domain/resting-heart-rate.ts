import { z } from "zod"
import { PLUS_RUN_2026_PROTOCOL } from "./plus-run-protocol"
import { percentileCont, roundOneDecimal } from "./statistics"
import { IsoDateSchema } from "./values"

const FamilyKeySchema = z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/)

const RestingHeartRateReadingSchema = z
  .object({
    localDate: IsoDateSchema,
    localTime: z.iso.time({ precision: 0 }),
    bpm: z.number().finite().min(20).max(240),
    sourceFamily: FamilyKeySchema,
    deviceFamily: FamilyKeySchema,
    status: z.enum(["pending_review", "accepted", "rejected"]),
  })
  .strict()
  .readonly()

const ReadingsSchema = z.array(RestingHeartRateReadingSchema).readonly()
type Reading = z.infer<typeof RestingHeartRateReadingSchema>

type WindowSummary = {
  readonly familyCount: number
  readonly sourceFamily: string | null
  readonly deviceFamily: string | null
  readonly distinctDays: number
  readonly medianBpm: number | null
}

export type RestingHeartRateResult = {
  readonly status: "complete" | "insufficient" | "mismatched_device"
  readonly baselineDistinctDays: number
  readonly comparisonDistinctDays: number
  readonly sourceFamily: string | null
  readonly deviceFamily: string | null
  readonly baselineWindowMedianBpm: number | null
  readonly comparisonWindowMedianBpm: number | null
  readonly rawChangeBpm: number | null
  readonly displayChangeBpm: number | null
  readonly outcomeLabel: "exploratory"
}

function summarizeWindow(readings: readonly Reading[]): WindowSummary {
  const families = new Set(
    readings.map((reading) => `${reading.sourceFamily}:${reading.deviceFamily}`),
  )
  const first = readings.at(0)
  if (families.size !== 1 || first === undefined) {
    return {
      familyCount: families.size,
      sourceFamily: null,
      deviceFamily: null,
      distinctDays: new Set(readings.map((reading) => reading.localDate)).size,
      medianBpm: null,
    }
  }
  const readingsByDay = new Map<string, number[]>()
  for (const reading of readings) {
    const dayReadings = readingsByDay.get(reading.localDate)
    if (dayReadings === undefined) {
      readingsByDay.set(reading.localDate, [reading.bpm])
    } else {
      dayReadings.push(reading.bpm)
    }
  }
  const dailyMedians = [...readingsByDay.values()].map((values) => percentileCont(values, 0.5))
  return {
    familyCount: 1,
    sourceFamily: first.sourceFamily,
    deviceFamily: first.deviceFamily,
    distinctDays: readingsByDay.size,
    medianBpm: dailyMedians.length === 0 ? null : percentileCont(dailyMedians, 0.5),
  }
}

export function calculateRestingHeartRateResult(input: unknown): RestingHeartRateResult {
  const acceptedMorning = ReadingsSchema.parse(input).filter(
    (reading) =>
      reading.status === "accepted" &&
      reading.localTime >= "04:00:00" &&
      reading.localTime <= "10:00:00",
  )
  const baseline = summarizeWindow(
    acceptedMorning.filter(
      (reading) =>
        reading.localDate >= PLUS_RUN_2026_PROTOCOL.restingHeartRateBaseline.startOn &&
        reading.localDate <= PLUS_RUN_2026_PROTOCOL.restingHeartRateBaseline.endOn,
    ),
  )
  const comparison = summarizeWindow(
    acceptedMorning.filter(
      (reading) =>
        reading.localDate >= PLUS_RUN_2026_PROTOCOL.restingHeartRateComparison.startOn &&
        reading.localDate <= PLUS_RUN_2026_PROTOCOL.restingHeartRateComparison.endOn,
    ),
  )
  const mismatched =
    baseline.familyCount > 1 ||
    comparison.familyCount > 1 ||
    (baseline.familyCount === 1 &&
      comparison.familyCount === 1 &&
      (baseline.sourceFamily !== comparison.sourceFamily ||
        baseline.deviceFamily !== comparison.deviceFamily))
  const insufficient =
    baseline.distinctDays < PLUS_RUN_2026_PROTOCOL.minimumRestingHeartRateDays ||
    comparison.distinctDays < PLUS_RUN_2026_PROTOCOL.minimumRestingHeartRateDays
  if (mismatched || insufficient || baseline.medianBpm === null || comparison.medianBpm === null) {
    return {
      status: mismatched ? "mismatched_device" : "insufficient",
      baselineDistinctDays: baseline.distinctDays,
      comparisonDistinctDays: comparison.distinctDays,
      sourceFamily: null,
      deviceFamily: null,
      baselineWindowMedianBpm: null,
      comparisonWindowMedianBpm: null,
      rawChangeBpm: null,
      displayChangeBpm: null,
      outcomeLabel: "exploratory",
    }
  }
  const rawChangeBpm = comparison.medianBpm - baseline.medianBpm
  return {
    status: "complete",
    baselineDistinctDays: baseline.distinctDays,
    comparisonDistinctDays: comparison.distinctDays,
    sourceFamily: baseline.sourceFamily,
    deviceFamily: baseline.deviceFamily,
    baselineWindowMedianBpm: baseline.medianBpm,
    comparisonWindowMedianBpm: comparison.medianBpm,
    rawChangeBpm,
    displayChangeBpm: roundOneDecimal(rawChangeBpm),
    outcomeLabel: "exploratory",
  }
}
