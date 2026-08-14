import { createClient } from "@supabase/supabase-js"
import { parseActivityInsightAcceptanceRequest } from "../../../src/integrations/activity-insight-acceptance.ts"
import { parseActivityInsightRebuildResponse } from "../../../src/integrations/activity-insight-contracts.ts"
import { handleBoundaryError, jsonResponse, RequestError } from "../_shared/http.ts"

Deno.serve(async (request) => {
  if (request.method !== "POST") return jsonResponse(405, { error: "method_not_allowed" })
  try {
    const url = Deno.env.get("SUPABASE_URL")
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const authorization = request.headers.get("authorization")
    if (!url || !serviceKey) throw new RequestError(503, "service_unavailable")
    if (authorization !== `Bearer ${serviceKey}`) {
      throw new RequestError(403, "service_credential_required")
    }

    let input: unknown
    try {
      input = await request.json()
    } catch (error) {
      if (error instanceof SyntaxError) throw new RequestError(400, "invalid_request")
      throw error
    }
    const parsedRequest = parseActivityInsightAcceptanceRequest(input)
    if (!parsedRequest.ok) throw new RequestError(400, parsedRequest.error)

    const serviceClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await serviceClient.rpc("accept_activity_import_and_rebuild", {
      target_rebuild: parsedRequest.value.rebuild,
      target_import: parsedRequest.value.acceptedImport,
      target_consent: parsedRequest.value.consentGrantId,
    })
    if (error) {
      if (error.code === "22023") throw new RequestError(400, "invalid_request")
      if (error.code === "23514") throw new RequestError(409, "acceptance_rejected")
      if (error.code === "42501") throw new RequestError(403, "acceptance_forbidden")
      throw new RequestError(500, "acceptance_failed")
    }
    const parsedResponse = parseActivityInsightRebuildResponse(data)
    if (!parsedResponse.ok) throw new RequestError(500, "invalid_response")
    return jsonResponse(201, parsedResponse.value)
  } catch (error) {
    if (error instanceof RequestError) {
      return jsonResponse(error.status, { error: error.code })
    }
    return handleBoundaryError(error)
  }
})
