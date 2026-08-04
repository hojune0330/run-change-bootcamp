import {
  type PilotMagicLinkRequestDiagnostic,
  processPilotMagicLinkRequest,
  requestPilotOtp,
} from "../_shared/pilot-magic-link-request.ts"

declare const EdgeRuntime: {
  waitUntil(task: Promise<unknown>): void
}

const RESPONSE_HEADERS = {
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-origin": "*",
  "cache-control": "no-store",
  "content-type": "application/json",
} as const

function allowedRedirect(callbackUrl: string): boolean {
  const allowedOrigins = new Set(
    (Deno.env.get("PILOT_ALLOWED_REDIRECT_ORIGINS") ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  )
  if (!URL.canParse(callbackUrl)) return false
  const callback = new URL(callbackUrl)
  return (
    allowedOrigins.has(callback.origin) &&
    callback.pathname === "/auth/callback" &&
    callback.search === "" &&
    callback.hash === ""
  )
}

function report(diagnostic: PilotMagicLinkRequestDiagnostic): void {
  console.error("pilot_magic_link_request", { diagnostic })
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: RESPONSE_HEADERS, status: 204 })
  }
  if (request.method !== "POST") {
    return Response.json(
      { error: "method_not_allowed" },
      { headers: RESPONSE_HEADERS, status: 405 },
    )
  }

  let input: unknown = null
  try {
    input = await request.json()
  } catch {
    report("invalid_request")
  }

  const authUrl = Deno.env.get("SUPABASE_URL") ?? ""
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  const result = processPilotMagicLinkRequest(input, {
    defer: (task) => EdgeRuntime.waitUntil(task),
    redirectAllowed: allowedRedirect,
    report,
    requestOtp: (requestInput) => {
      if (!authUrl || !publicKey) {
        report("request_unconfigured")
        return Promise.resolve()
      }
      return requestPilotOtp(requestInput, {
        authUrl,
        fetcher: globalThis.fetch,
        publicKey,
      })
    },
  })
  return Response.json(result, { headers: RESPONSE_HEADERS, status: 202 })
})
