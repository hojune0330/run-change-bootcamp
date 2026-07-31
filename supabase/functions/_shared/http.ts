import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export type RequestContext = {
  readonly userId: string
  readonly userClient: SupabaseClient
  readonly serviceClient: SupabaseClient
}

export class RequestError extends Error {
  readonly name = "RequestError"
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code)
  }
}

export async function authenticate(request: Request): Promise<RequestContext> {
  const url = Deno.env.get("SUPABASE_URL")
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const authorization = request.headers.get("authorization")
  if (!url || !publishableKey || !serviceKey) throw new RequestError(503, "service_unavailable")
  if (!authorization?.startsWith("Bearer ")) throw new RequestError(401, "authentication_required")

  const token = authorization.slice("Bearer ".length)
  const userClient = createClient(url, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await userClient.auth.getUser(token)
  if (error || !data.user) throw new RequestError(401, "invalid_token")
  const serviceClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return { userId: data.user.id, userClient, serviceClient }
}

export function jsonResponse(status: number, body: unknown): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", vary: "authorization" },
  })
}

export function handleBoundaryError(error: unknown): Response {
  if (error instanceof RequestError) return jsonResponse(error.status, { error: error.code })
  console.error("edge_function_failed", {
    errorName: error instanceof Error ? error.name : "unknown",
  })
  return jsonResponse(500, { error: "internal_error" })
}
