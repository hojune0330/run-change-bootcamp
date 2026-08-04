import { Webhook } from "npm:standardwebhooks@1.0.0"
import { createClient } from "@supabase/supabase-js"
import {
  type PilotHookDiagnostic,
  type PilotMagicLinkDelivery,
  processPilotMagicLinkHook,
} from "../_shared/pilot-magic-link-hook.ts"

declare const EdgeRuntime: {
  waitUntil(task: Promise<unknown>): void
}

const JSON_HEADERS = { "cache-control": "no-store", "content-type": "application/json" } as const

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

function deliveryBoundary():
  | { readonly kind: "configured"; readonly send: (input: PilotMagicLinkDelivery) => Promise<void> }
  | { readonly kind: "unavailable" } {
  const apiKey = Deno.env.get("RESEND_API_KEY")
  const from = Deno.env.get("PILOT_AUTH_EMAIL_FROM")
  if (!apiKey || !from) return { kind: "unavailable" }
  return {
    kind: "configured",
    send: async (input) => {
      const response = await fetch("https://api.resend.com/emails", {
        body: JSON.stringify({
          from,
          subject: "PLUS Run 파일럿 로그인",
          text: `아래 로그인 링크는 15분 동안 유효합니다.\n\n${input.actionLink}`,
          to: [input.to],
        }),
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        method: "POST",
      })
      if (!response.ok) throw new Error("pilot_email_provider_rejected")
    },
  }
}

function report(diagnostic: PilotHookDiagnostic): void {
  console.error("pilot_magic_link_hook", { diagnostic })
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { headers: JSON_HEADERS, status: 405 })
  }
  const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET")
  if (!hookSecret) {
    return Response.json({ error: "hook_unavailable" }, { headers: JSON_HEADERS, status: 503 })
  }

  let event: unknown
  try {
    const body = await request.text()
    const webhook = new Webhook(hookSecret.replace("v1,whsec_", ""))
    event = webhook.verify(body, Object.fromEntries(request.headers))
  } catch {
    return Response.json(
      { error: "invalid_hook_signature" },
      { headers: JSON_HEADERS, status: 401 },
    )
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  const result = await processPilotMagicLinkHook(event, request.headers.get("webhook-id") ?? "", {
    authUrl: supabaseUrl,
    claim: async (email, eventId, userId) => {
      if (!supabaseUrl || !serviceKey) throw new Error("pilot_hook_service_unavailable")
      const serviceClient = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const claim = await serviceClient.rpc("claim_pilot_magic_link_delivery", {
        hook_event_id: eventId,
        hook_user_id: userId,
        invitee_email: email,
      })
      if (claim.error !== null) throw new Error("pilot_hook_claim_failed")
      return claim.data
    },
    defer: (task) => EdgeRuntime.waitUntil(task),
    delivery: deliveryBoundary(),
    redirectAllowed: allowedRedirect,
    report,
  })
  return Response.json(result, { headers: JSON_HEADERS, status: 200 })
})
