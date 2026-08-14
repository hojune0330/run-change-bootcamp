import { z } from "zod"
import {
  canonicalizeImportQualityFlags,
  IMPORT_FORMATS,
  IMPORT_QUALITY_FLAGS,
} from "../domain/imports-model"
import { MAX_SCREENSHOT_BYTES } from "./ai-safety"

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: "invalid_request" }

export type ScreenshotDraftRequest = {
  readonly uploadId: string
  readonly idempotencyKey: string
  readonly deidentified: true
}

export type FeedbackDraftRequest = {
  readonly submissionId: string
  readonly idempotencyKey: string
}

export type FeedbackApprovalRequest = {
  readonly feedbackId: string
  readonly decision: "approved" | "rejected"
  readonly note?: string
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/

const acceptedMetricsSchema = z
  .object({
    distanceM: z.number().finite().positive().optional(),
    durationS: z.number().finite().positive().optional(),
    paceSecondsPerKm: z.number().finite().positive().optional(),
    averageHeartRateBpm: z.number().finite().min(20).max(250).optional(),
    maxHeartRateBpm: z.number().finite().min(20).max(250).optional(),
    steps: z.number().int().nonnegative().optional(),
    elevationGainM: z.number().finite().nonnegative().optional(),
  })
  .strict()
  .refine((metrics) => Object.keys(metrics).length > 0)

const acceptedStructuredImportRequestSchema = z
  .object({
    programId: z.string().regex(UUID_PATTERN),
    participantId: z.string().regex(UUID_PATTERN),
    format: z.enum(IMPORT_FORMATS),
    observedAt: z.iso.datetime({ offset: true }),
    sourceFamily: z.string().trim().min(1).max(80),
    sourceModel: z.string().trim().min(1).max(120).optional(),
    timezone: z.literal("Asia/Seoul"),
    qualityFlags: z
      .array(z.enum(IMPORT_QUALITY_FLAGS))
      .max(12)
      .transform(canonicalizeImportQualityFlags),
    metrics: acceptedMetricsSchema,
  })
  .strict()
  .readonly()
export type AcceptedStructuredImportRequest = z.infer<typeof acceptedStructuredImportRequestSchema>

const inMemoryScreenshotRequestSchema = z
  .object({
    consentGrantId: z.string().regex(UUID_PATTERN),
    attestationId: z.string().regex(UUID_PATTERN),
    idempotencyKey: z.string().regex(IDEMPOTENCY_PATTERN),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    byteLength: z.number().int().positive().max(MAX_SCREENSHOT_BYTES),
  })
  .strict()
  .readonly()
export type InMemoryScreenshotRequest = z.infer<typeof inMemoryScreenshotRequestSchema>

export const FeedbackItemAutomationSchema = z
  .object({
    id: z.string().regex(UUID_PATTERN),
    participantId: z.string().regex(UUID_PATTERN),
    consentGrantId: z.string().regex(UUID_PATTERN).optional(),
    attestationId: z.string().regex(UUID_PATTERN).optional(),
    origin: z.enum(["coach", "ai"]),
    status: z.enum(["draft", "pending_approval", "published", "rejected"]),
    approvedBy: z.string().regex(UUID_PATTERN).optional(),
    approvedAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict()
  .superRefine((feedback, context) => {
    const hasAiEvidence = Boolean(feedback.consentGrantId && feedback.attestationId)
    if ((feedback.origin === "ai") !== hasAiEvidence) {
      context.addIssue({
        code: "custom",
        path: ["consentGrantId"],
        message: "AI origin requires consent and attestation",
      })
    }
    if (
      feedback.origin === "ai" &&
      feedback.status === "published" &&
      (!feedback.approvedBy || !feedback.approvedAt)
    ) {
      context.addIssue({
        code: "custom",
        path: ["approvedBy"],
        message: "published AI feedback requires named-coach approval",
      })
    }
  })
  .readonly()

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input)
}

function hasOnlyKeys(input: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(input).every((key) => keys.includes(key))
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value)
}

function isIdempotencyKey(value: unknown): value is string {
  return typeof value === "string" && IDEMPOTENCY_PATTERN.test(value)
}

export function parseAcceptedStructuredImportRequest(
  input: unknown,
): ParseResult<AcceptedStructuredImportRequest> {
  const parsed = acceptedStructuredImportRequestSchema.safeParse(input)
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: "invalid_request" }
}

export function parseInMemoryScreenshotRequest(
  input: unknown,
): ParseResult<InMemoryScreenshotRequest> {
  const parsed = inMemoryScreenshotRequestSchema.safeParse(input)
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: "invalid_request" }
}

export function parseScreenshotDraftRequest(input: unknown): ParseResult<ScreenshotDraftRequest> {
  if (!isRecord(input) || !hasOnlyKeys(input, ["uploadId", "idempotencyKey", "deidentified"])) {
    return { ok: false, error: "invalid_request" }
  }
  const { uploadId, idempotencyKey, deidentified } = input
  if (!isUuid(uploadId) || !isIdempotencyKey(idempotencyKey) || deidentified !== true) {
    return { ok: false, error: "invalid_request" }
  }
  return { ok: true, value: { uploadId, idempotencyKey, deidentified: true } }
}

export function parseFeedbackDraftRequest(input: unknown): ParseResult<FeedbackDraftRequest> {
  if (!isRecord(input) || !hasOnlyKeys(input, ["submissionId", "idempotencyKey"])) {
    return { ok: false, error: "invalid_request" }
  }
  const { submissionId, idempotencyKey } = input
  if (!isUuid(submissionId) || !isIdempotencyKey(idempotencyKey)) {
    return { ok: false, error: "invalid_request" }
  }
  return { ok: true, value: { submissionId, idempotencyKey } }
}

export function parseFeedbackApprovalRequest(input: unknown): ParseResult<FeedbackApprovalRequest> {
  if (!isRecord(input) || !hasOnlyKeys(input, ["feedbackId", "decision", "note"])) {
    return { ok: false, error: "invalid_request" }
  }
  const { feedbackId, decision, note } = input
  if (!isUuid(feedbackId) || (decision !== "approved" && decision !== "rejected")) {
    return { ok: false, error: "invalid_request" }
  }
  if (note === undefined) return { ok: true, value: { feedbackId, decision } }
  if (typeof note !== "string" || note.length > 500) {
    return { ok: false, error: "invalid_request" }
  }
  return { ok: true, value: { feedbackId, decision, note } }
}
