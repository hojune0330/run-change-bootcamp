import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { AiConsentError } from "./ai-consent.ts"
import { RequestError } from "./http.ts"

const STALE_AFTER_MS = 5 * 60 * 1_000
const aiRequestSchema = z.object({
  id: z.string().uuid(),
  requested_by: z.string().uuid(),
  program_id: z.string().uuid(),
  request_kind: z.enum(["metric_extraction", "feedback_draft"]),
  target_id: z.string().uuid(),
  status: z.enum(["processing", "succeeded", "failed"]),
  last_started_at: z.string().datetime({ offset: true }),
})

type AiRequest = z.infer<typeof aiRequestSchema>

export type AiRequestSpec = {
  readonly requestedBy: string
  readonly programId: string
  readonly requestKind: "metric_extraction" | "feedback_draft"
  readonly targetId: string
  readonly idempotencyKey: string
}

export type AiJobLease = {
  readonly kind: "claimed"
  readonly requestId: string
  readonly lastStartedAt: string
}

export type AiRequestClaim =
  | AiJobLease
  | { readonly kind: "succeeded"; readonly requestId: string }
  | { readonly kind: "processing"; readonly requestId: string }

function parseRequest(value: unknown): AiRequest {
  const parsed = aiRequestSchema.safeParse(value)
  if (!parsed.success) throw new RequestError(500, "job_read_failed")
  return parsed.data
}

async function readExisting(client: SupabaseClient, spec: AiRequestSpec): Promise<AiRequest> {
  const { data, error } = await client
    .from("ai_requests")
    .select("id,requested_by,program_id,request_kind,target_id,status,last_started_at")
    .eq("requested_by", spec.requestedBy)
    .eq("idempotency_key", spec.idempotencyKey)
    .maybeSingle()
  if (error || !data) throw new RequestError(500, "job_read_failed")
  const existing = parseRequest(data)
  if (
    existing.program_id !== spec.programId ||
    existing.request_kind !== spec.requestKind ||
    existing.target_id !== spec.targetId
  ) {
    throw new RequestError(409, "idempotency_key_conflict")
  }
  return existing
}

function claimed(request: AiRequest): AiJobLease {
  return {
    kind: "claimed",
    requestId: request.id,
    lastStartedAt: request.last_started_at,
  }
}

export async function claimAiRequest(
  client: SupabaseClient,
  spec: AiRequestSpec,
): Promise<AiRequestClaim> {
  const lastStartedAt = new Date().toISOString()
  const { data: inserted, error: insertError } = await client
    .from("ai_requests")
    .insert({
      requested_by: spec.requestedBy,
      program_id: spec.programId,
      request_kind: spec.requestKind,
      target_id: spec.targetId,
      idempotency_key: spec.idempotencyKey,
      status: "processing",
      last_started_at: lastStartedAt,
    })
    .select("id,requested_by,program_id,request_kind,target_id,status,last_started_at")
    .maybeSingle()
  if (!insertError) {
    if (!inserted) throw new RequestError(500, "job_create_failed")
    return claimed(parseRequest(inserted))
  }
  if (insertError.code !== "23505") throw new RequestError(500, "job_create_failed")

  let existing = await readExisting(client, spec)
  if (existing.status === "succeeded") {
    return { kind: "succeeded", requestId: existing.id }
  }
  if (existing.status === "failed") {
    const { data: retried, error: retryError } = await client
      .from("ai_requests")
      .update({
        status: "processing",
        last_started_at: lastStartedAt,
        completed_at: null,
        error_code: null,
        provider_response_id: null,
      })
      .eq("id", existing.id)
      .eq("status", "failed")
      .eq("last_started_at", existing.last_started_at)
      .select("id,requested_by,program_id,request_kind,target_id,status,last_started_at")
      .maybeSingle()
    if (retryError) throw new RequestError(500, "job_claim_failed")
    if (retried) return claimed(parseRequest(retried))
    existing = await readExisting(client, spec)
  }

  if (existing.status === "succeeded") {
    return { kind: "succeeded", requestId: existing.id }
  }
  if (existing.status === "failed") throw new RequestError(409, "job_claim_contended")

  const staleBefore = new Date(Date.now() - STALE_AFTER_MS).toISOString()
  if (Date.parse(existing.last_started_at) >= Date.parse(staleBefore)) {
    return { kind: "processing", requestId: existing.id }
  }
  const { data: reclaimed, error: reclaimError } = await client
    .from("ai_requests")
    .update({
      last_started_at: lastStartedAt,
      completed_at: null,
      error_code: null,
      provider_response_id: null,
    })
    .eq("id", existing.id)
    .eq("status", "processing")
    .eq("last_started_at", existing.last_started_at)
    .lt("last_started_at", staleBefore)
    .select("id,requested_by,program_id,request_kind,target_id,status,last_started_at")
    .maybeSingle()
  if (reclaimError) throw new RequestError(500, "job_claim_failed")
  if (reclaimed) return claimed(parseRequest(reclaimed))

  existing = await readExisting(client, spec)
  if (existing.status === "succeeded") {
    return { kind: "succeeded", requestId: existing.id }
  }
  return { kind: "processing", requestId: existing.id }
}

export async function completeAiRequest(
  client: SupabaseClient,
  lease: AiJobLease,
  providerResponseId: string | null,
): Promise<void> {
  const { data, error } = await client
    .from("ai_requests")
    .update({
      status: "succeeded",
      completed_at: new Date().toISOString(),
      error_code: null,
      provider_response_id: providerResponseId,
    })
    .eq("id", lease.requestId)
    .eq("status", "processing")
    .eq("last_started_at", lease.lastStartedAt)
    .select("id")
    .maybeSingle()
  if (error || !data) throw new RequestError(500, "job_complete_failed")
}

export async function failAiRequest(
  client: SupabaseClient,
  lease: AiJobLease,
  errorCode: string,
): Promise<void> {
  const { data, error } = await client
    .from("ai_requests")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_code: errorCode,
    })
    .eq("id", lease.requestId)
    .eq("status", "processing")
    .eq("last_started_at", lease.lastStartedAt)
    .select("id")
    .maybeSingle()
  if (error || !data) throw new RequestError(500, "job_fail_failed")
}

export function aiFailureCode(error: unknown): string {
  return error instanceof RequestError || error instanceof AiConsentError
    ? error.code
    : "internal_error"
}
