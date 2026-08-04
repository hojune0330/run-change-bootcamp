import { z } from "zod"
import type { SupabasePublicConfig } from "./runtime-config.ts"

const AuthOtpRequestSchema = z
  .object({
    code_challenge: z.string().min(43).max(128),
    code_challenge_method: z.literal("s256"),
    create_user: z.literal(false),
    email: z.email(),
  })
  .passthrough()
  .readonly()

function invalidProxyRequest(): Response {
  return Response.json(
    { code: "unexpected_failure", message: "Invalid internal magic-link request" },
    { headers: { "cache-control": "no-store" }, status: 500 },
  )
}

export function createPilotAuthFetch(
  config: SupabasePublicConfig,
  fetcher: typeof fetch = globalThis.fetch,
): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    if (request.method !== "POST" || url.pathname !== "/auth/v1/otp") {
      return fetcher(input, init)
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return invalidProxyRequest()
    }
    const parsed = AuthOtpRequestSchema.safeParse(body)
    const callbackUrl = url.searchParams.get("redirect_to")
    if (!parsed.success || callbackUrl === null) return invalidProxyRequest()

    return fetcher(new URL("/functions/v1/request-pilot-magic-link", config.url), {
      body: JSON.stringify({
        callbackUrl,
        codeChallenge: parsed.data.code_challenge,
        codeChallengeMethod: parsed.data.code_challenge_method,
        email: parsed.data.email,
      }),
      cache: "no-store",
      headers: request.headers,
      method: "POST",
    })
  }
}
