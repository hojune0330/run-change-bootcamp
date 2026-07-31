import { z } from "zod"
import { createSafetyIdentifier, validateScreenshot } from "../../../src/integrations/ai-safety.ts"
import { parseScreenshotDraftRequest } from "../../../src/integrations/contracts.ts"
import { buildMetricExtractionRequest } from "../../../src/integrations/openai-contracts.ts"
import { parseMetricDraftOutput } from "../../../src/integrations/provider-response.ts"
import {
  aiFailureCode,
  claimAiRequest,
  completeAiRequest,
  failAiRequest,
} from "../_shared/ai-jobs.ts"
import { authenticate, handleBoundaryError, jsonResponse, RequestError } from "../_shared/http.ts"
import { providerConfig, requestStructuredOutput } from "../_shared/openai.ts"

const uploadSchema = z.object({
  id: z.string().uuid(),
  program_id: z.string().uuid(),
  owner_profile_id: z.string().uuid(),
  bucket_id: z.literal("screenshots"),
  object_path: z.string().min(1),
  upload_kind: z.literal("screenshot"),
  byte_size: z
    .number()
    .int()
    .positive()
    .max(8 * 1024 * 1024),
})

Deno.serve(async (request) => {
  if (request.method !== "POST") return jsonResponse(405, { error: "method_not_allowed" })
  try {
    const context = await authenticate(request)
    const parsedRequest = parseScreenshotDraftRequest(await request.json())
    if (!parsedRequest.ok) throw new RequestError(400, parsedRequest.error)
    const { data: rawUpload, error: uploadError } = await context.userClient
      .from("data_uploads")
      .select("id,program_id,owner_profile_id,bucket_id,object_path,upload_kind,byte_size")
      .eq("id", parsedRequest.value.uploadId)
      .maybeSingle()
    const upload = uploadSchema.safeParse(rawUpload)
    if (uploadError || !upload.success || upload.data.owner_profile_id !== context.userId) {
      throw new RequestError(404, "upload_not_found")
    }

    const claim = await claimAiRequest(context.serviceClient, {
      requestedBy: context.userId,
      programId: upload.data.program_id,
      requestKind: "metric_extraction",
      targetId: upload.data.id,
      idempotencyKey: parsedRequest.value.idempotencyKey,
    })
    if (claim.kind === "processing") {
      return jsonResponse(202, { requestId: claim.requestId, status: "processing" })
    }
    if (claim.kind === "succeeded") {
      return jsonResponse(200, { requestId: claim.requestId, status: "replayed" })
    }

    try {
      const { count: storedDraftCount, error: storedDraftError } = await context.serviceClient
        .from("metric_records")
        .select("id", { count: "exact", head: true })
        .eq("ai_request_id", claim.requestId)
      if (storedDraftError || storedDraftCount === null) {
        throw new RequestError(500, "draft_read_failed")
      }
      if (storedDraftCount > 0) {
        await completeAiRequest(context.serviceClient, claim, null)
        return jsonResponse(200, {
          requestId: claim.requestId,
          draftCount: storedDraftCount,
          status: "replayed",
        })
      }

      const config = providerConfig()
      const { data: blob, error: downloadError } = await context.userClient.storage
        .from(upload.data.bucket_id)
        .download(upload.data.object_path)
      if (downloadError || !blob) throw new RequestError(422, "upload_unreadable")
      const image = validateScreenshot(new Uint8Array(await blob.arrayBuffer()))
      if (!image.ok) throw new RequestError(422, image.error)
      const safetyId = await createSafetyIdentifier(context.userId, config.safetySalt)
      const provider = await requestStructuredOutput(
        config,
        parsedRequest.value.idempotencyKey,
        buildMetricExtractionRequest(config, safetyId, image.value),
      )
      const drafts = parseMetricDraftOutput(provider.value)
      if (!drafts.ok) throw new RequestError(502, drafts.error)
      const rows = drafts.value.map((draft, draftIndex) => ({
        program_id: upload.data.program_id,
        owner_profile_id: context.userId,
        upload_id: upload.data.id,
        ai_request_id: claim.requestId,
        draft_index: draftIndex,
        source: "screenshot",
        metric_type: draft.metricType,
        numeric_value: draft.value,
        unit: draft.unit,
        observed_at: draft.observedAt,
        sensitivity: "health",
        verification_status: "draft",
        extraction_confidence: draft.confidence,
      }))
      const { error: storeError } = await context.serviceClient
        .from("metric_records")
        .upsert(rows, {
          onConflict: "ai_request_id,draft_index",
          ignoreDuplicates: true,
        })
      if (storeError) throw new RequestError(500, "draft_store_failed")
      await completeAiRequest(context.serviceClient, claim, provider.responseId)
      return jsonResponse(201, {
        requestId: claim.requestId,
        draftCount: rows.length,
        status: "draft",
      })
    } catch (error) {
      await failAiRequest(context.serviceClient, claim, aiFailureCode(error))
      throw error
    }
  } catch (error) {
    return handleBoundaryError(error)
  }
})
