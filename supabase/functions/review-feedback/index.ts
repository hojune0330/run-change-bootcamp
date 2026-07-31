import { parseFeedbackApprovalRequest } from "../../../src/integrations/contracts.ts"
import { authenticate, handleBoundaryError, jsonResponse, RequestError } from "../_shared/http.ts"

Deno.serve(async (request) => {
  if (request.method !== "POST") return jsonResponse(405, { error: "method_not_allowed" })
  try {
    const context = await authenticate(request)
    const parsed = parseFeedbackApprovalRequest(await request.json())
    if (!parsed.ok) throw new RequestError(400, parsed.error)
    const { data, error } = await context.userClient.rpc("review_feedback", {
      target_feedback: parsed.value.feedbackId,
      target_decision: parsed.value.decision,
      review_note: parsed.value.note ?? null,
    })
    if (error) throw new RequestError(error.code === "42501" ? 403 : 409, "feedback_review_failed")
    return jsonResponse(200, { feedbackId: data, decision: parsed.value.decision })
  } catch (error) {
    return handleBoundaryError(error)
  }
})
