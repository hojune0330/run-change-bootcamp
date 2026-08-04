import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it, vi } from "vitest"
import {
  type PilotHookDiagnostic,
  type PilotMagicLinkClaim,
  type PilotMagicLinkDelivery,
  processPilotMagicLinkHook,
} from "../../../supabase/functions/_shared/pilot-magic-link-hook.ts"

const HOOK_EVENT_ID = "msg_pilot_hook_01"
const USER_ID = "11111111-1111-4111-8111-111111111111"
const VALID_EVENT = {
  email_data: {
    email_action_type: "magiclink",
    redirect_to: "https://pilot.example.com/auth/callback",
    token_hash: "single-use-token-hash",
  },
  user: { email: "runner@example.com", id: USER_ID },
} as const

type RunResult = {
  readonly deliveries: PilotMagicLinkDelivery[]
  readonly diagnostics: PilotHookDiagnostic[]
  readonly response: Readonly<Record<string, never>>
}

async function runHook(
  decision: PilotMagicLinkClaim,
  deliveryKind: "configured" | "unavailable" = "configured",
): Promise<RunResult> {
  const deliveries: PilotMagicLinkDelivery[] = []
  const diagnostics: PilotHookDiagnostic[] = []
  const tasks: Promise<void>[] = []
  const delivery =
    deliveryKind === "configured"
      ? {
          kind: "configured" as const,
          send: async (input: PilotMagicLinkDelivery) => {
            deliveries.push(input)
          },
        }
      : ({ kind: "unavailable" } as const)
  const response = await processPilotMagicLinkHook(VALID_EVENT, HOOK_EVENT_ID, {
    authUrl: "https://boundary-test.supabase.co",
    claim: async () => decision,
    defer: (task) => tasks.push(task),
    delivery,
    redirectAllowed: (url) => url === VALID_EVENT.email_data.redirect_to,
    report: (diagnostic) => diagnostics.push(diagnostic),
  })
  await Promise.all(tasks)
  return { deliveries, diagnostics, response }
}

describe("pilot magic-link Auth Hook", () => {
  it("returns an indistinguishable response for send, unknown, retry, and replay decisions", async () => {
    // Given
    const decisions: PilotMagicLinkClaim[] = [
      { status: "send" },
      { status: "ignore" },
      { status: "resend_guard" },
      { status: "replayed" },
    ]

    // When
    const results = await Promise.all(decisions.map((decision) => runHook(decision)))

    // Then
    expect(results.map((result) => result.response)).toEqual([{}, {}, {}, {}])
    expect(results.map((result) => result.deliveries.length)).toEqual([1, 0, 0, 0])
  })

  it("sends only the provider-safe verification link for an eligible delivery", async () => {
    // Given
    // When
    const result = await runHook({ status: "send" })

    // Then
    expect(result.deliveries).toHaveLength(1)
    const delivery = result.deliveries[0]
    expect(delivery?.to).toBe("runner@example.com")
    const link = new URL(delivery?.actionLink ?? "")
    expect(link.origin).toBe("https://boundary-test.supabase.co")
    expect(link.pathname).toBe("/auth/v1/verify")
    expect(link.searchParams.get("token")).toBe("single-use-token-hash")
    expect(link.searchParams.get("type")).toBe("magiclink")
    expect(link.searchParams.get("redirect_to")).toBe("https://pilot.example.com/auth/callback")
    expect([...link.searchParams.keys()].sort()).toEqual(["redirect_to", "token", "type"])
  })

  it("rejects non-magic-link email actions before claim or delivery", async () => {
    // Given
    const claim = vi.fn(async () => ({ status: "send" }) as const)
    const send = vi.fn(async () => undefined)
    const diagnostics: PilotHookDiagnostic[] = []

    // When
    const response = await processPilotMagicLinkHook(
      {
        ...VALID_EVENT,
        email_data: { ...VALID_EVENT.email_data, email_action_type: "recovery" },
      },
      HOOK_EVENT_ID,
      {
        authUrl: "https://boundary-test.supabase.co",
        claim,
        defer: () => undefined,
        delivery: { kind: "configured", send },
        redirectAllowed: () => true,
        report: (diagnostic) => diagnostics.push(diagnostic),
      },
    )

    // Then
    expect(response).toEqual({})
    expect(diagnostics).toEqual(["invalid_event"])
    expect(claim).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it("fails closed with zero sends when the email provider is not configured", async () => {
    // Given
    // When
    const result = await runHook({ status: "send" }, "unavailable")

    // Then
    expect(result.response).toEqual({})
    expect(result.deliveries).toEqual([])
    expect(result.diagnostics).toEqual(["delivery_unconfigured"])
  })

  it("treats an uninvited direct Auth OTP hook event as generic success with zero sends", async () => {
    // Given
    const claim = vi.fn(async () => ({ status: "ignore" }) as const)
    const send = vi.fn(async () => undefined)

    // When
    const response = await processPilotMagicLinkHook(VALID_EVENT, HOOK_EVENT_ID, {
      authUrl: "https://boundary-test.supabase.co",
      claim,
      defer: () => undefined,
      delivery: { kind: "configured", send },
      redirectAllowed: () => true,
      report: () => undefined,
    })

    // Then
    expect(response).toEqual({})
    expect(claim).toHaveBeenCalledWith("runner@example.com", HOOK_EVENT_ID, USER_ID)
    expect(send).not.toHaveBeenCalled()
  })

  it("verifies Standard Webhooks before claims and records the signed event id for replay defense", () => {
    // Given
    const source = readFileSync(
      resolve(process.cwd(), "supabase/functions/send-pilot-magic-link/index.ts"),
      "utf8",
    )

    // When
    // Then
    expect(source).toContain('new Webhook(hookSecret.replace("v1,whsec_", ""))')
    expect(source).toContain("webhook.verify(body, Object.fromEntries(request.headers))")
    expect(source).toContain('request.headers.get("webhook-id")')
    expect(source).toContain("hook_event_id: eventId")
    expect(source).not.toContain("console.log")
    expect(source).not.toMatch(/console\.error\([^\n]*(email|token|event)/i)
  })
})
