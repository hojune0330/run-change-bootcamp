import { z } from "zod"
import {
  AcceptedStructuredImportRecordSchema,
  type AcceptedStructuredImportRecord,
} from "./imports-model"
import { MembershipIdSchema } from "./ids"
import { IsoDateSchema, IsoDateTimeSchema } from "./values"

const SEOUL_TIME_ZONE = "Asia/Seoul" as const
const DAY_MS = 24 * 60 * 60 * 1_000

export const ACTIVITY_INSIGHT_TEMPLATE_VERSION = "activity-insight-v1" as const

export const ACTIVITY_INSIGHT_TEMPLATES = {
  one_day: {
    category: "activity_summary",
    variant: "one_day",
    title: "활동 기록 요약",
    summary: "이번 주 활동 기록이 하루 확인됐어요.",
    nextStep: "현재 리듬에 맞춰 다음 활동을 기록해 보세요.",
  },
  multiple_days: {
    category: "activity_summary",
    variant: "multiple_days",
    title: "활동 기록 요약",
    summary: "이번 주 활동 기록이 여러 날 확인됐어요.",
    nextStep: "현재 리듬에 맞춰 다음 활동을 기록해 보세요.",
  },
} as const

export type ActivityInsightTemplateKey = keyof typeof ACTIVITY_INSIGHT_TEMPLATES
export type ActivityInsightTemplate = (typeof ACTIVITY_INSIGHT_TEMPLATES)[ActivityInsightTemplateKey]

export type ActivityInsightProvenance = {
  readonly recordId: AcceptedStructuredImportRecord["id"]
  readonly parserName: string
  readonly parserVersion: string
  readonly sourceFamily: string
  readonly sourceModel?: string
}

export type WeeklyActivityInsight = {
  readonly kind: "weekly_activity_insight"
  readonly templateVersion: typeof ACTIVITY_INSIGHT_TEMPLATE_VERSION
  readonly programId: string
  readonly participantId: AcceptedStructuredImportRecord["participantId"]
  readonly period: {
    readonly start: z.infer<typeof IsoDateSchema>
    readonly endExclusive: z.infer<typeof IsoDateSchema>
    readonly timezone: typeof SEOUL_TIME_ZONE
  }
  readonly status: "partial" | "complete"
  readonly isPartialWeek: boolean
  readonly aggregates: {
    readonly distanceM: number
    readonly durationS: number
    readonly steps: number
    readonly paceSecondsPerKm: number | null
    readonly activityDays: number
    readonly averageHeartRateBpm: number | null
  }
  readonly activityDates: readonly z.infer<typeof IsoDateSchema>[]
  readonly provenance: readonly ActivityInsightProvenance[]
  readonly templateKey: ActivityInsightTemplateKey
  readonly content: ActivityInsightTemplate
}

export class ActivityInsightInputError extends Error {
  readonly name = "ActivityInsightInputError"
}

const WeeklyActivityInsightRequestSchema = z
  .object({
    programId: z.string().trim().min(3).max(120),
    participantId: MembershipIdSchema,
    weekStart: IsoDateSchema,
    asOf: IsoDateTimeSchema.optional(),
    now: IsoDateTimeSchema.optional(),
    records: z.array(AcceptedStructuredImportRecordSchema).readonly(),
  })
  .strict()
  .superRefine((request, context) => {
    if (request.asOf === undefined && request.now === undefined) {
      context.addIssue({
        code: "custom",
        path: ["asOf"],
        message: "an as-of instant is required",
      })
    }
    if (request.asOf !== undefined && request.now !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["now"],
        message: "provide either asOf or now, not both",
      })
    }
  })

function parseInstant(value: string): number {
  const instant = Date.parse(value)
  if (!Number.isFinite(instant)) {
    throw new ActivityInsightInputError("activity insight dates must be valid instants")
  }
  return instant
}

function dateAtSeoulMidnight(localDate: string): number {
  return parseInstant(`${localDate}T00:00:00+09:00`)
}

function addCalendarDays(localDate: string, days: number): z.infer<typeof IsoDateSchema> {
  const instant = parseInstant(`${localDate}T00:00:00.000Z`) + days * DAY_MS
  return IsoDateSchema.parse(new Date(instant).toISOString().slice(0, 10))
}

function calendarDaysBetween(start: string, end: string): number {
  const startMs = parseInstant(`${start}T00:00:00.000Z`)
  const endMs = parseInstant(`${end}T00:00:00.000Z`)
  return Math.floor((endMs - startMs) / DAY_MS)
}

function seoulCalendarDate(instant: number): z.infer<typeof IsoDateSchema> {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
  }).formatToParts(new Date(instant))
  let year: string | undefined
  let month: string | undefined
  let day: string | undefined
  for (const part of parts) {
    if (part.type === "year") year = part.value
    if (part.type === "month") month = part.value
    if (part.type === "day") day = part.value
  }
  if (year === undefined || month === undefined || day === undefined) {
    throw new ActivityInsightInputError("Seoul calendar date formatting failed")
  }
  return IsoDateSchema.parse(`${year}-${month}-${day}`)
}

function sumFinite(total: number, value: number): number {
  const next = total + value
  if (!Number.isFinite(next)) {
    throw new ActivityInsightInputError("activity insight aggregate is out of range")
  }
  return next
}

function provenanceFor(record: AcceptedStructuredImportRecord): ActivityInsightProvenance {
  return record.sourceModel === undefined
    ? {
        recordId: record.id,
        parserName: record.parserName,
        parserVersion: record.parserVersion,
        sourceFamily: record.sourceFamily,
      }
    : {
        recordId: record.id,
        parserName: record.parserName,
        parserVersion: record.parserVersion,
        sourceFamily: record.sourceFamily,
        sourceModel: record.sourceModel,
      }
}

export function buildWeeklyActivityInsight(input: unknown): WeeklyActivityInsight | null {
  const request = WeeklyActivityInsightRequestSchema.parse(input)
  const asOf = request.asOf ?? request.now
  if (asOf === undefined) {
    throw new ActivityInsightInputError("an as-of instant is required")
  }
  const weekStart = request.weekStart
  const weekStartUtc = parseInstant(`${weekStart}T00:00:00.000Z`)
  if (new Date(weekStartUtc).getUTCDay() !== 1) {
    throw new ActivityInsightInputError("weekStart must be a Monday")
  }
  const weekEnd = addCalendarDays(weekStart, 7)
  const periodStartMs = dateAtSeoulMidnight(weekStart)
  const periodEndMs = dateAtSeoulMidnight(weekEnd)
  const recordIds = new Set<string>()
  const duplicateHmacs = new Set<string>()
  for (const record of request.records) {
    if (recordIds.has(record.id) || duplicateHmacs.has(record.serverDuplicateHmac)) {
      throw new ActivityInsightInputError("duplicate accepted activity record")
    }
    recordIds.add(record.id)
    duplicateHmacs.add(record.serverDuplicateHmac)
    if (record.programId !== request.programId || record.participantId !== request.participantId) {
      throw new ActivityInsightInputError("activity record belongs to another participant or program")
    }
    if (record.qualityFlags.includes("duplicate_suspected")) {
      throw new ActivityInsightInputError("duplicate-suspected activity records are not eligible")
    }
  }

  const records = request.records
    .filter((record) => {
      const observedAt = parseInstant(record.observedAt)
      return observedAt >= periodStartMs && observedAt < periodEndMs
    })
    .toSorted((left, right) => left.id.localeCompare(right.id))
  if (records.length === 0) return null

  let distanceM = 0
  let durationS = 0
  let steps = 0
  let weightedHeartRate = 0
  let weightedDurationS = 0
  for (const record of records) {
    const metrics = record.metrics
    if (metrics.distanceM !== undefined) distanceM = sumFinite(distanceM, metrics.distanceM)
    if (metrics.durationS !== undefined) durationS = sumFinite(durationS, metrics.durationS)
    if (metrics.steps !== undefined) steps = sumFinite(steps, metrics.steps)
    if (metrics.durationS !== undefined && metrics.averageHeartRateBpm !== undefined) {
      weightedDurationS = sumFinite(weightedDurationS, metrics.durationS)
      weightedHeartRate = sumFinite(
        weightedHeartRate,
        metrics.durationS * metrics.averageHeartRateBpm,
      )
    }
  }

  const activityDates = [
    ...new Set(records.map((record) => seoulCalendarDate(parseInstant(record.observedAt)))),
  ].toSorted()
  const asOfMs = parseInstant(asOf)
  const isCurrentWeek = asOfMs >= periodStartMs && asOfMs < periodEndMs
  const elapsedDays = isCurrentWeek
    ? calendarDaysBetween(weekStart, seoulCalendarDate(asOfMs))
    : 7
  const isPartialWeek = isCurrentWeek && elapsedDays < 7
  const activityDays = activityDates.length
  const templateKey: ActivityInsightTemplateKey =
    activityDays === 1 ? "one_day" : "multiple_days"
  const paceSecondsPerKm =
    distanceM > 0 && durationS > 0 ? durationS / (distanceM / 1_000) : null
  const averageHeartRateBpm =
    weightedDurationS > 0 ? weightedHeartRate / weightedDurationS : null

  return {
    kind: "weekly_activity_insight",
    templateVersion: ACTIVITY_INSIGHT_TEMPLATE_VERSION,
    programId: request.programId,
    participantId: request.participantId,
    period: {
      start: weekStart,
      endExclusive: weekEnd,
      timezone: SEOUL_TIME_ZONE,
    },
    status: isPartialWeek ? "partial" : "complete",
    isPartialWeek,
    aggregates: {
      distanceM,
      durationS,
      steps,
      paceSecondsPerKm,
      activityDays,
      averageHeartRateBpm,
    },
    activityDates,
    provenance: records.map(provenanceFor),
    templateKey,
    content: ACTIVITY_INSIGHT_TEMPLATES[templateKey],
  }
}
