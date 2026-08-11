import { z } from "zod"
import type { ParseResult } from "./contracts"

const UUIDSchema = z.uuid()
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/
const IDEMPOTENCY_KEY_SCHEMA = z.string().regex(IDEMPOTENCY_KEY_PATTERN)
const DAY_MS = 24 * 60 * 60 * 1_000

function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`)
}

function isCanonicalIsoDate(value: string): boolean {
  const parsed = parseIsoDate(value)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function isSeoulMonday(value: string): boolean {
  return isCanonicalIsoDate(value) && parseIsoDate(value).getUTCDay() === 1
}

const SEOUL_WEEK_START_SCHEMA = z.iso
  .date()
  .refine(isSeoulMonday, "weekStart must be a Monday in Asia/Seoul")

const ACCEPTED_IMPORT_IDS_SCHEMA = z
  .array(UUIDSchema)
  .max(500)
  .superRefine((ids, context) => {
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: "custom", message: "accepted import IDs must be unique" })
    }
  })
  .readonly()

export const ActivityInsightRebuildRequestSchema = z
  .object({
    programId: UUIDSchema,
    participantId: UUIDSchema,
    acceptedImportIds: ACCEPTED_IMPORT_IDS_SCHEMA,
    weekStart: SEOUL_WEEK_START_SCHEMA,
    idempotencyKey: IDEMPOTENCY_KEY_SCHEMA,
  })
  .strict()
  .readonly()
export type ActivityInsightRebuildRequest = z.infer<typeof ActivityInsightRebuildRequestSchema>

const ACTIVITY_INSIGHT_STATUS = ["rebuilt", "removed"] as const
const ACTIVITY_INSIGHT_TEMPLATE_VERSION = /^activity-insight\.v[0-9]+$/

export const ActivityInsightRebuildResponseSchema = z
  .object({
    status: z.enum(ACTIVITY_INSIGHT_STATUS),
    insightId: UUIDSchema.optional(),
    programId: UUIDSchema,
    participantId: UUIDSchema,
    weekStart: SEOUL_WEEK_START_SCHEMA,
    weekEnd: z.iso.date().refine(isCanonicalIsoDate),
    sourceCount: z.number().int().nonnegative().max(500),
    templateVersion: z.string().regex(ACTIVITY_INSIGHT_TEMPLATE_VERSION),
  })
  .strict()
  .superRefine((response, context) => {
    const expectedWeekEnd = new Date(parseIsoDate(response.weekStart).getTime() + 7 * DAY_MS)
      .toISOString()
      .slice(0, 10)
    if (response.weekEnd !== expectedWeekEnd) {
      context.addIssue({
        code: "custom",
        path: ["weekEnd"],
        message: "weekEnd must follow weekStart",
      })
    }
    if (response.status === "rebuilt" && response.insightId === undefined) {
      context.addIssue({
        code: "custom",
        path: ["insightId"],
        message: "rebuilt response requires insightId",
      })
    }
    if (response.status === "removed" && response.insightId !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["insightId"],
        message: "removed response cannot expose insightId",
      })
    }
  })
  .readonly()
export type ActivityInsightRebuildResponse = z.infer<typeof ActivityInsightRebuildResponseSchema>

export function parseActivityInsightRebuildRequest(
  input: unknown,
): ParseResult<ActivityInsightRebuildRequest> {
  const parsed = ActivityInsightRebuildRequestSchema.safeParse(input)
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: "invalid_request" }
}

export function parseActivityInsightRebuildResponse(
  input: unknown,
): ParseResult<ActivityInsightRebuildResponse> {
  const parsed = ActivityInsightRebuildResponseSchema.safeParse(input)
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: "invalid_request" }
}
