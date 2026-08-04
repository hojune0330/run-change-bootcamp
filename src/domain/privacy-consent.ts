import { z } from "zod"
import { ConsentGrantIdSchema, ConsentRevocationIdSchema, MembershipIdSchema } from "./ids"
import { IsoDateTimeSchema, NonEmptyTextSchema } from "./values"

export type { ConsentItem, ConsentPurpose } from "./privacy-consent-contract"
export {
  CONSENT_PURPOSES,
  ConsentItemSchema,
  ConsentPurposeSchema,
} from "./privacy-consent-contract"
export type { ConsentGrant, NamedCoachGrant } from "./privacy-consent-grants"
export {
  ConsentGrantSchema,
  NamedCoachGrantSchema,
} from "./privacy-consent-grants"
export { authorizeOpenAiConsent } from "./privacy-consent-project"

export const ConsentRevocationSchema = z
  .object({
    id: ConsentRevocationIdSchema,
    grantId: ConsentGrantIdSchema,
    participantId: MembershipIdSchema,
    revokedAt: IsoDateTimeSchema,
    reason: NonEmptyTextSchema.max(500).optional(),
  })
  .strict()
  .readonly()
export type ConsentRevocation = z.infer<typeof ConsentRevocationSchema>
