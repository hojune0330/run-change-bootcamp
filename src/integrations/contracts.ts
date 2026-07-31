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

export function parseScreenshotDraftRequest(input: unknown): ParseResult<ScreenshotDraftRequest> {
  if (!isRecord(input) || !hasOnlyKeys(input, ["uploadId", "idempotencyKey", "deidentified"])) {
    return { ok: false, error: "invalid_request" }
  }
  const uploadId = input["uploadId"]
  const idempotencyKey = input["idempotencyKey"]
  if (!isUuid(uploadId) || !isIdempotencyKey(idempotencyKey) || input["deidentified"] !== true) {
    return { ok: false, error: "invalid_request" }
  }
  return { ok: true, value: { uploadId, idempotencyKey, deidentified: true } }
}

export function parseFeedbackDraftRequest(input: unknown): ParseResult<FeedbackDraftRequest> {
  if (!isRecord(input) || !hasOnlyKeys(input, ["submissionId", "idempotencyKey"])) {
    return { ok: false, error: "invalid_request" }
  }
  const submissionId = input["submissionId"]
  const idempotencyKey = input["idempotencyKey"]
  if (!isUuid(submissionId) || !isIdempotencyKey(idempotencyKey)) {
    return { ok: false, error: "invalid_request" }
  }
  return { ok: true, value: { submissionId, idempotencyKey } }
}

export function parseFeedbackApprovalRequest(input: unknown): ParseResult<FeedbackApprovalRequest> {
  if (!isRecord(input) || !hasOnlyKeys(input, ["feedbackId", "decision", "note"])) {
    return { ok: false, error: "invalid_request" }
  }
  const feedbackId = input["feedbackId"]
  const decision = input["decision"]
  const note = input["note"]
  if (!isUuid(feedbackId) || (decision !== "approved" && decision !== "rejected")) {
    return { ok: false, error: "invalid_request" }
  }
  if (note === undefined) return { ok: true, value: { feedbackId, decision } }
  if (typeof note !== "string" || note.length > 500) {
    return { ok: false, error: "invalid_request" }
  }
  return { ok: true, value: { feedbackId, decision, note } }
}
