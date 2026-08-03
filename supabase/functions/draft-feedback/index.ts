import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { createSafetyIdentifier } from "../../../src/integrations/ai-safety.ts"
import { parseFeedbackDraftRequest } from "../../../src/integrations/contracts.ts"
import { buildFeedbackRequest } from "../../../src/integrations/openai-contracts.ts"
import { parseFeedbackDraftOutput } from "../../../src/integrations/provider-response.ts"
import { assertActiveAiConsent, withActiveAiConsent } from "../_shared/ai-consent.ts"
import {
  aiFailureCode,
  claimAiRequest,
  completeAiRequest,
  failAiRequest,
} from "../_shared/ai-jobs.ts"
import { authenticate, handleBoundaryError, jsonResponse, RequestError } from "../_shared/http.ts"
import { providerConfig, requestStructuredOutput } from "../_shared/openai.ts"

const submissionSchema = z.object({
  id: z.string().uuid(),
  program_id: z.string().uuid(),
  participant_id: z.string().uuid(),
  response_text: z.string().nullable(),
})
const feedbackIdSchema = z.object({ id: z.string().uuid() })

async function findFeedbackId(client: SupabaseClient, requestId: string): Promise<string | null> {
  const { data, error } = await client
    .from("feedback_items")
    .select("id")
    .eq("ai_request_id", requestId)
    .maybeSingle()
  if (error) throw new RequestError(500, "draft_read_failed")
  if (!data) return null
  const parsed = feedbackIdSchema.safeParse(data)
  if (!parsed.success) throw new RequestError(500, "draft_read_failed")
  return parsed.data.id
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return jsonResponse(405, { error: "method_not_allowed" })
  try {
    const context = await authenticate(request)
    const parsedRequest = parseFeedbackDraftRequest(await request.json())
    if (!parsedRequest.ok) throw new RequestError(400, parsedRequest.error)
    const { data: membership } = await context.userClient
      .from("program_memberships")
      .select("program_id,role")
      .eq("profile_id", context.userId)
      .in("role", ["coach", "admin"])
    const { data: rawSubmission, error } = await context.userClient
      .from("homework_submissions")
      .select("id,program_id,participant_id,response_text")
      .eq("id", parsedRequest.value.submissionId)
      .maybeSingle()
    const submission = submissionSchema.safeParse(rawSubmission)
    if (
      error ||
      !submission.success ||
      !membership?.some((item) => item.program_id === submission.data.program_id)
    ) {
      throw new RequestError(403, "feedback_draft_forbidden")
    }
    const config = providerConfig()
    const consentSpec = {
      programId: submission.data.program_id,
      participantId: submission.data.participant_id,
      purpose: "generative_feedback_ai",
      projectId: config.projectId,
    } as const
    await assertActiveAiConsent(context.serviceClient, consentSpec)
    const claim = await claimAiRequest(context.serviceClient, {
      requestedBy: context.userId,
      programId: submission.data.program_id,
      requestKind: "feedback_draft",
      targetId: submission.data.id,
      idempotencyKey: parsedRequest.value.idempotencyKey,
    })
    if (claim.kind === "processing") {
      return jsonResponse(202, { requestId: claim.requestId, status: "processing" })
    }
    if (claim.kind === "succeeded") {
      return jsonResponse(200, { requestId: claim.requestId, status: "replayed" })
    }

    try {
      const storedFeedbackId = await findFeedbackId(context.serviceClient, claim.requestId)
      if (storedFeedbackId !== null) {
        await completeAiRequest(context.serviceClient, claim, null)
        return jsonResponse(200, {
          requestId: claim.requestId,
          feedbackId: storedFeedbackId,
          status: "replayed",
        })
      }

      const safetyId = await createSafetyIdentifier(context.userId, config.safetySalt)
      const providerRequest = buildFeedbackRequest(
        config,
        safetyId,
        submission.data.response_text ?? "Submission completed.",
      )
      const provider = await withActiveAiConsent(context.serviceClient, consentSpec, () =>
        requestStructuredOutput(config, parsedRequest.value.idempotencyKey, providerRequest),
      )
      const draft = parseFeedbackDraftOutput(provider.value)
      if (!draft.ok) throw new RequestError(502, draft.error)
      const { error: storeError } = await context.serviceClient.from("feedback_items").upsert(
        {
          program_id: submission.data.program_id,
          participant_id: submission.data.participant_id,
          submission_id: submission.data.id,
          ai_request_id: claim.requestId,
          origin: "ai",
          classification: draft.value.classification,
          body: draft.value.draftText,
          status: draft.value.status,
          created_by: context.userId,
        },
        { onConflict: "ai_request_id", ignoreDuplicates: true },
      )
      if (storeError) throw new RequestError(500, "draft_store_failed")
      const feedbackId = await findFeedbackId(context.serviceClient, claim.requestId)
      if (feedbackId === null) throw new RequestError(500, "draft_store_failed")
      await completeAiRequest(context.serviceClient, claim, provider.responseId)
      return jsonResponse(201, {
        requestId: claim.requestId,
        feedbackId,
        status: "pending_approval",
      })
    } catch (error) {
      await failAiRequest(context.serviceClient, claim, aiFailureCode(error))
      throw error
    }
  } catch (error) {
    return handleBoundaryError(error)
  }
})
