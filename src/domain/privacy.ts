import { z } from "zod"
import {
  AssessmentResultIdSchema,
  AuditEventIdSchema,
  ConsentGrantIdSchema,
  ConsentRevocationIdSchema,
  FeedbackApprovalIdSchema,
  HealthMetricIdSchema,
  ImportArtifactIdSchema,
  MembershipIdSchema,
  ProgramInstanceIdSchema,
} from "./ids"
import { TimeTrialProtocolSchema } from "./schedule"
import { IsoDateTimeSchema, NonEmptyTextSchema } from "./values"

export const ConsentItemSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("health_metric"), id: HealthMetricIdSchema })
    .strict()
    .readonly(),
  z
    .object({ kind: z.literal("assessment_result"), id: AssessmentResultIdSchema })
    .strict()
    .readonly(),
])
export type ConsentItem = z.infer<typeof ConsentItemSchema>

export const ConsentGrantSchema = z
  .object({
    id: ConsentGrantIdSchema,
    participantId: MembershipIdSchema,
    audience: z.enum(["coach", "stakeholder", "peers"]),
    item: ConsentItemSchema,
    grantedAt: IsoDateTimeSchema,
  })
  .strict()
  .readonly()
export type ConsentGrant = z.infer<typeof ConsentGrantSchema>

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

const auditBase = {
  id: AuditEventIdSchema,
  actorId: MembershipIdSchema,
  occurredAt: IsoDateTimeSchema,
} as const

export const AuditEventSchema = z.discriminatedUnion("kind", [
  z
    .object({ ...auditBase, kind: z.literal("consent_granted"), grantId: ConsentGrantIdSchema })
    .strict()
    .readonly(),
  z
    .object({
      ...auditBase,
      kind: z.literal("consent_revoked"),
      revocationId: ConsentRevocationIdSchema,
      grantId: ConsentGrantIdSchema,
    })
    .strict()
    .readonly(),
  z
    .object({
      ...auditBase,
      kind: z.literal("time_trial_decided"),
      programId: ProgramInstanceIdSchema,
      session: z.union([z.literal(1), z.literal(2)]),
      protocol: TimeTrialProtocolSchema,
    })
    .strict()
    .readonly(),
  z
    .object({
      ...auditBase,
      kind: z.literal("import_received"),
      artifactId: ImportArtifactIdSchema,
    })
    .strict()
    .readonly(),
  z
    .object({
      ...auditBase,
      kind: z.literal("feedback_approved"),
      approvalId: FeedbackApprovalIdSchema,
    })
    .strict()
    .readonly(),
])
export type AuditEvent = z.infer<typeof AuditEventSchema>
