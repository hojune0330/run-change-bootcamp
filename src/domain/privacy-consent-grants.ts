import { z } from "zod"
import { ConsentGrantIdSchema, MembershipIdSchema } from "./ids"
import {
  ConsentItemSchema,
  ConsentPurposeSchema,
  DateTimeOrNull,
  PrivacyIdSchema,
  ProfileRefOrNull,
  ProgramRefSchema,
  PURPOSE_CONTRACTS,
} from "./privacy-consent-contract"
import { IsoDateTimeSchema } from "./values"

const ConsentGrantShape = z
  .object({
    id: ConsentGrantIdSchema,
    programId: ProgramRefSchema,
    participantProfileId: PrivacyIdSchema,
    purpose: ConsentPurposeSchema,
    provider: z.string().trim().min(2).max(80),
    providerProjectId: z.string().trim().min(3).max(128).nullable(),
    endpoint: z.union([
      z.literal("/v1/responses"),
      z
        .string()
        .trim()
        .min(3)
        .max(80)
        .regex(/^[a-z][a-z0-9_]{2,79}$/),
    ]),
    dataClasses: z.array(z.string().trim().min(1).max(120)).min(1).readonly(),
    statedPurpose: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/^[a-z][a-z0-9_]{2,79}$/),
    recipient: z
      .string()
      .trim()
      .min(3)
      .max(120)
      .regex(/^[a-z][a-z0-9_]{2,119}$/),
    recipientProfileId: ProfileRefOrNull,
    audience: z
      .string()
      .trim()
      .min(3)
      .max(120)
      .regex(/^[a-z][a-z0-9_]{2,119}$/),
    control: z
      .string()
      .trim()
      .min(3)
      .max(120)
      .regex(/^[a-z][a-z0-9_]{2,119}$/),
    processorDisclosure: z
      .string()
      .trim()
      .min(3)
      .max(120)
      .regex(/^[a-z][a-z0-9_]{2,119}$/)
      .nullable(),
    zeroDataRetentionControl: z.literal("approved_project_endpoint_zdr").nullable(),
    grantedAt: IsoDateTimeSchema,
    expiresAt: IsoDateTimeSchema,
    status: z.enum(["active", "withdrawn"]).default("active"),
    withdrawnAt: DateTimeOrNull,
    withdrawnByProfileId: ProfileRefOrNull.optional(),
    withdrawalReasonCode: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/^[a-z][a-z0-9_]{2,79}$/)
      .nullable()
      .optional(),
  })
  .strict()
  .readonly()
const ConsentGrantValidated = ConsentGrantShape.superRefine((grant, context) => {
  const expected = PURPOSE_CONTRACTS[grant.purpose]
  const checks: readonly [boolean, string, string][] = [
    [grant.provider === expected.provider, "provider", "provider does not match purpose"],
    [
      expected.providerProjectId === "required"
        ? grant.providerProjectId !== null
        : grant.providerProjectId === expected.providerProjectId,
      "providerProjectId",
      "provider project does not match purpose",
    ],
    [grant.endpoint === expected.endpoint, "endpoint", "endpoint does not match purpose"],
    [
      JSON.stringify(grant.dataClasses) === JSON.stringify(expected.dataClasses),
      "dataClasses",
      "data classes do not match purpose",
    ],
    [
      grant.statedPurpose === expected.statedPurpose,
      "statedPurpose",
      "stated purpose does not match purpose",
    ],
    [grant.recipient === expected.recipient, "recipient", "recipient does not match purpose"],
    [
      expected.recipientProfileRequired
        ? grant.recipientProfileId !== null
        : grant.recipientProfileId === null,
      "recipientProfileId",
      "recipient profile does not match purpose",
    ],
    [grant.audience === expected.audience, "audience", "audience does not match purpose"],
    [grant.control === expected.control, "control", "control does not match purpose"],
    [
      grant.processorDisclosure === expected.processorDisclosure,
      "processorDisclosure",
      "processor disclosure does not match purpose",
    ],
    [
      grant.zeroDataRetentionControl === expected.zeroDataRetentionControl,
      "zeroDataRetentionControl",
      "ZDR control does not match purpose",
    ],
  ]
  for (const [valid, path, message] of checks)
    if (!valid) context.addIssue({ code: "custom", path: [path], message })
  if (Date.parse(grant.expiresAt) <= Date.parse(grant.grantedAt))
    context.addIssue({
      code: "custom",
      path: ["expiresAt"],
      message: "consent must expire after grant",
    })
  const withdrawnFields = [
    grant.withdrawnAt,
    grant.withdrawnByProfileId,
    grant.withdrawalReasonCode,
  ]
  if (grant.status === "active" && withdrawnFields.some((value) => value != null))
    context.addIssue({
      code: "custom",
      path: ["status"],
      message: "active consent cannot contain withdrawal metadata",
    })
  if (grant.status === "withdrawn" && !withdrawnFields.every((value) => value != null))
    context.addIssue({
      code: "custom",
      path: ["status"],
      message: "withdrawn consent requires complete withdrawal metadata",
    })
  if (grant.status === "withdrawn" && grant.withdrawnByProfileId !== grant.participantProfileId)
    context.addIssue({
      code: "custom",
      path: ["withdrawnByProfileId"],
      message: "only the participant may withdraw consent",
    })
  if (
    grant.status === "withdrawn" &&
    grant.withdrawnAt != null &&
    Date.parse(grant.withdrawnAt) < Date.parse(grant.grantedAt)
  )
    context.addIssue({
      code: "custom",
      path: ["withdrawnAt"],
      message: "withdrawal cannot precede grant",
    })
})
const CanonicalConsentGrantSchema = ConsentGrantValidated.transform((grant) =>
  Object.freeze({
    ...grant,
    participantId: grant.participantProfileId,
    item: ConsentItemSchema.parse({ kind: "health_metric", id: grant.id }),
  }),
)
const LegacyConsentGrantSchema = z
  .object({
    id: ConsentGrantIdSchema,
    participantId: MembershipIdSchema,
    audience: z.enum(["coach", "stakeholder", "peers"]),
    item: ConsentItemSchema,
    grantedAt: IsoDateTimeSchema,
  })
  .strict()
  .readonly()
  .transform((grant) => Object.freeze(grant))
export const ConsentGrantSchema = z.union([CanonicalConsentGrantSchema, LegacyConsentGrantSchema])
export type ConsentGrant = z.infer<typeof ConsentGrantSchema>

export const NamedCoachGrantSchema = z
  .object({
    id: ConsentGrantIdSchema,
    consentGrantId: ConsentGrantIdSchema,
    programId: ProgramRefSchema,
    participantProfileId: PrivacyIdSchema,
    coachProfileId: PrivacyIdSchema,
    grantedAt: IsoDateTimeSchema,
    expiresAt: IsoDateTimeSchema,
    status: z.enum(["active", "withdrawn"]).default("active"),
    withdrawnAt: DateTimeOrNull,
    withdrawnByProfileId: ProfileRefOrNull.optional(),
    withdrawalReasonCode: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/^[a-z][a-z0-9_]{2,79}$/)
      .nullable()
      .optional(),
  })
  .strict()
  .readonly()
  .superRefine((grant, context) => {
    if (grant.participantProfileId === grant.coachProfileId)
      context.addIssue({
        code: "custom",
        path: ["coachProfileId"],
        message: "participant and coach must differ",
      })
    if (Date.parse(grant.expiresAt) <= Date.parse(grant.grantedAt))
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "grant must expire after creation",
      })
    const withdrawn = [grant.withdrawnAt, grant.withdrawnByProfileId, grant.withdrawalReasonCode]
    if (grant.status === "active" && withdrawn.some((value) => value != null))
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "active grant cannot contain withdrawal metadata",
      })
    if (grant.status === "withdrawn" && !withdrawn.every((value) => value != null))
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "withdrawn grant requires complete withdrawal metadata",
      })
    if (grant.status === "withdrawn" && grant.withdrawnByProfileId !== grant.participantProfileId)
      context.addIssue({
        code: "custom",
        path: ["withdrawnByProfileId"],
        message: "only the participant may withdraw the named-coach grant",
      })
  })
export type NamedCoachGrant = z.infer<typeof NamedCoachGrantSchema>
