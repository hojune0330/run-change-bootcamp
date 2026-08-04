import { z } from "zod"
import {
  AuditEventIdSchema,
  ConsentGrantIdSchema,
  ConsentRevocationIdSchema,
  FeedbackApprovalIdSchema,
  ImportArtifactIdSchema,
  ProgramInstanceIdSchema,
} from "./ids"
import { PrivacyIdSchema, ProgramRefSchema } from "./privacy-audiences-core"
import { TimeTrialProtocolSchema } from "./schedule"
import { IsoDateTimeSchema } from "./values"

export * from "./privacy-audiences"
export * from "./privacy-consent"

const auditBase = {
  id: AuditEventIdSchema,
  actorId: PrivacyIdSchema,
  occurredAt: IsoDateTimeSchema,
} as const
const SensitiveReadEventSchema = z.enum([
  "sensitive.metric_projection.participant_read",
  "sensitive.metric_projection.named_coach_read",
  "sensitive.private_question.participant_read",
  "sensitive.private_question.named_coach_read",
  "sensitive.private_question.participant_metadata_read",
  "sensitive.private_question.named_coach_metadata_read",
])
const SensitiveReadProjectionSchema = z.enum([
  "participant_sensitive_metrics",
  "named_coach_sensitive_metrics",
  "participant_private_question",
  "named_coach_private_question",
  "participant_private_question_metadata",
  "named_coach_private_question_metadata",
])
const SensitiveReadAuditEventSchema = z
  .object({
    ...auditBase,
    kind: z.literal("sensitive_read"),
    event: SensitiveReadEventSchema,
    projection: SensitiveReadProjectionSchema,
    programId: ProgramRefSchema,
    subjectProfileId: PrivacyIdSchema,
    entityType: z.enum(["metric_projection", "private_question_thread"]),
    entityId: PrivacyIdSchema,
  })
  .strict()
  .readonly()
  .superRefine((event, context) => {
    const expected = {
      "sensitive.metric_projection.participant_read": {
        projection: "participant_sensitive_metrics",
        entityType: "metric_projection",
      },
      "sensitive.metric_projection.named_coach_read": {
        projection: "named_coach_sensitive_metrics",
        entityType: "metric_projection",
      },
      "sensitive.private_question.participant_read": {
        projection: "participant_private_question",
        entityType: "private_question_thread",
      },
      "sensitive.private_question.named_coach_read": {
        projection: "named_coach_private_question",
        entityType: "private_question_thread",
      },
      "sensitive.private_question.participant_metadata_read": {
        projection: "participant_private_question_metadata",
        entityType: "private_question_thread",
      },
      "sensitive.private_question.named_coach_metadata_read": {
        projection: "named_coach_private_question_metadata",
        entityType: "private_question_thread",
      },
    } as const
    const contract = expected[event.event]
    if (event.projection !== contract.projection)
      context.addIssue({
        code: "custom",
        path: ["projection"],
        message: "audit projection does not match event",
      })
    if (event.entityType !== contract.entityType)
      context.addIssue({
        code: "custom",
        path: ["entityType"],
        message: "audit entity does not match event",
      })
  })
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
  SensitiveReadAuditEventSchema,
])
export type AuditEvent = z.infer<typeof AuditEventSchema>
