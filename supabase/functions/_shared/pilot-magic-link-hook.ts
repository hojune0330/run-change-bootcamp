import { z } from "zod"

const HookEventSchema = z.object({
  email_data: z.object({
    email_action_type: z.literal("magiclink"),
    redirect_to: z.url(),
    token_hash: z.string().min(1).max(2048),
  }),
  user: z.object({
    email: z.email(),
    id: z.uuid(),
  }),
})

const ClaimDecisionSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("send") }).strict(),
  z.object({ status: z.literal("ignore") }).strict(),
  z.object({ status: z.literal("replayed") }).strict(),
  z.object({ status: z.literal("resend_guard") }).strict(),
])

export type PilotMagicLinkClaim = z.infer<typeof ClaimDecisionSchema>

export type PilotMagicLinkDelivery = {
  readonly actionLink: string
  readonly to: string
}

export type PilotHookDiagnostic =
  | "claim_failed"
  | "delivery_failed"
  | "delivery_unconfigured"
  | "invalid_event"
  | "invalid_redirect"

export type PilotHookDependencies = {
  readonly authUrl: string
  readonly claim: (email: string, eventId: string, userId: string) => Promise<unknown>
  readonly defer: (task: Promise<void>) => void
  readonly delivery:
    | {
        readonly kind: "configured"
        readonly send: (input: PilotMagicLinkDelivery) => Promise<void>
      }
    | { readonly kind: "unavailable" }
  readonly redirectAllowed: (callbackUrl: string) => boolean
  readonly report: (diagnostic: PilotHookDiagnostic) => void
}

export const PILOT_HOOK_ACCEPTED = Object.freeze({})

function verificationUrl(
  authUrl: string,
  redirectTo: string,
  tokenHash: string,
  emailActionType: "magiclink",
): string {
  const url = new URL("/auth/v1/verify", authUrl)
  url.searchParams.set("token", tokenHash)
  url.searchParams.set("type", emailActionType)
  url.searchParams.set("redirect_to", redirectTo)
  return url.href
}

export async function processPilotMagicLinkHook(
  input: unknown,
  eventId: string,
  dependencies: PilotHookDependencies,
): Promise<Readonly<Record<string, never>>> {
  const event = HookEventSchema.safeParse(input)
  if (!event.success) {
    dependencies.report("invalid_event")
    return PILOT_HOOK_ACCEPTED
  }
  if (!dependencies.redirectAllowed(event.data.email_data.redirect_to)) {
    dependencies.report("invalid_redirect")
    return PILOT_HOOK_ACCEPTED
  }

  let rawClaim: unknown
  try {
    rawClaim = await dependencies.claim(event.data.user.email, eventId, event.data.user.id)
  } catch {
    dependencies.report("claim_failed")
    return PILOT_HOOK_ACCEPTED
  }
  const claim = ClaimDecisionSchema.safeParse(rawClaim)
  if (!claim.success || claim.data.status !== "send") return PILOT_HOOK_ACCEPTED
  if (dependencies.delivery.kind === "unavailable") {
    dependencies.report("delivery_unconfigured")
    return PILOT_HOOK_ACCEPTED
  }

  const delivery = dependencies.delivery
    .send({
      actionLink: verificationUrl(
        dependencies.authUrl,
        event.data.email_data.redirect_to,
        event.data.email_data.token_hash,
        event.data.email_data.email_action_type,
      ),
      to: event.data.user.email,
    })
    .catch(() => dependencies.report("delivery_failed"))
  dependencies.defer(delivery)
  return PILOT_HOOK_ACCEPTED
}
