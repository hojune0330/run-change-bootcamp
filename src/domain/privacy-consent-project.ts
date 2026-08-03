import type { z } from "zod"
import { ConsentGrantSchema } from "./privacy-consent-grants"
import type { IsoDateTimeSchema } from "./values"

type AiPurpose = "screenshot_ai" | "generative_feedback_ai"
type AuthorizationInput = {
  readonly grant: unknown | null
  readonly expectedPurpose: AiPurpose
  readonly expectedProjectId: string
  readonly now: z.infer<typeof IsoDateTimeSchema>
}

function removeParsedCompatibilityFields(grant: unknown): unknown {
  if (grant === null || typeof grant !== "object") return grant
  const candidate = grant as Record<string, unknown>
  if (
    !(
      "purpose" in candidate &&
      "participantProfileId" in candidate &&
      "participantId" in candidate &&
      "item" in candidate
    )
  )
    return grant
  const { participantId: _participantId, item: _item, ...canonical } = candidate
  return canonical
}

export function authorizeOpenAiConsent(input: AuthorizationInput): boolean {
  if (input.expectedProjectId.trim().length < 3) return false
  const parsed = ConsentGrantSchema.safeParse(removeParsedCompatibilityFields(input.grant))
  if (!parsed.success || !("purpose" in parsed.data)) return false
  const grant = parsed.data
  if (
    grant.purpose !== input.expectedPurpose ||
    grant.provider !== "openai" ||
    grant.providerProjectId !== input.expectedProjectId
  )
    return false
  if (grant.endpoint !== "/v1/responses" || grant.status !== "active") return false
  const now = Date.parse(input.now)
  const grantedAt = Date.parse(grant.grantedAt)
  const expiresAt = Date.parse(grant.expiresAt)
  return Number.isFinite(now) && now >= grantedAt && now < expiresAt
}
