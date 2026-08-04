import { z } from "zod"
import { ProgramInstanceIdSchema } from "./ids"
import { IsoDateTimeSchema } from "./values"

export const PrivacyIdSchema = z.union([
  z.uuid(),
  z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(/^[a-z][a-z0-9-]*$/),
])
export const ProgramRefSchema = z.union([ProgramInstanceIdSchema, z.uuid()])
export const DateTimeOrNull = IsoDateTimeSchema.nullable().optional()
export const ProfileRefOrNull = PrivacyIdSchema.nullable()

export const ConsentItemSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("health_metric"), id: PrivacyIdSchema })
    .strict()
    .readonly(),
  z
    .object({ kind: z.literal("assessment_result"), id: PrivacyIdSchema })
    .strict()
    .readonly(),
])
export type ConsentItem = z.infer<typeof ConsentItemSchema>

export const CONSENT_PURPOSES = [
  "program_data_processing",
  "named_coach_sensitive_metrics",
  "screenshot_ai",
  "generative_feedback_ai",
  "social_publication",
  "aggregate_analysis_reporting",
] as const
export const ConsentPurposeSchema = z.enum(CONSENT_PURPOSES)
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number]
export type ConsentContract = {
  readonly provider: string
  readonly providerProjectId: string | null
  readonly endpoint: string
  readonly dataClasses: readonly string[]
  readonly statedPurpose: string
  readonly recipient: string
  readonly recipientProfileRequired: boolean
  readonly audience: string
  readonly control: string
  readonly processorDisclosure: string | null
  readonly zeroDataRetentionControl: string | null
}
export const PURPOSE_CONTRACTS = {
  program_data_processing: {
    provider: "plus_run_first_party",
    providerProjectId: null,
    endpoint: "program_operational_database",
    dataClasses: ["identity", "enrollment", "program_activity"],
    statedPurpose: "program_data_processing",
    recipient: "program_operations",
    recipientProfileRequired: false,
    audience: "participant_and_program_operations",
    control: "participant_withdrawal",
    processorDisclosure: null,
    zeroDataRetentionControl: null,
  },
  named_coach_sensitive_metrics: {
    provider: "plus_run_first_party",
    providerProjectId: null,
    endpoint: "audited_sensitive_metric_projection",
    dataClasses: ["activity_metrics", "health_metrics", "pain_metrics"],
    statedPurpose: "named_coach_sensitive_metrics",
    recipient: "named_coach",
    recipientProfileRequired: true,
    audience: "participant_and_named_coach",
    control: "participant_revocable_named_grant",
    processorDisclosure: null,
    zeroDataRetentionControl: null,
  },
  screenshot_ai: {
    provider: "openai",
    providerProjectId: "required",
    endpoint: "/v1/responses",
    dataClasses: ["server_sanitized_screenshot_pixels", "reviewable_metric_draft"],
    statedPurpose: "screenshot_metric_draft_extraction",
    recipient: "openai",
    recipientProfileRequired: false,
    audience: "processor_for_participant_draft_only",
    control: "per_request_participant_review",
    processorDisclosure: "openai_subprocessor_disclosed",
    zeroDataRetentionControl: "approved_project_endpoint_zdr",
  },
  generative_feedback_ai: {
    provider: "openai",
    providerProjectId: "required",
    endpoint: "/v1/responses",
    dataClasses: ["approved_nonsensitive_training_context", "feedback_draft"],
    statedPurpose: "generative_feedback_draft_creation",
    recipient: "openai",
    recipientProfileRequired: false,
    audience: "processor_and_named_coach_review",
    control: "named_coach_review_required",
    processorDisclosure: "openai_subprocessor_disclosed",
    zeroDataRetentionControl: "approved_project_endpoint_zdr",
  },
  social_publication: {
    provider: "plus_run_first_party",
    providerProjectId: null,
    endpoint: "program_social_feed",
    dataClasses: ["low_information_social_content"],
    statedPurpose: "social_publication",
    recipient: "program_cohort",
    recipientProfileRequired: false,
    audience: "program_cohort",
    control: "explicit_per_post_publication",
    processorDisclosure: null,
    zeroDataRetentionControl: null,
  },
  aggregate_analysis_reporting: {
    provider: "plus_run_first_party",
    providerProjectId: null,
    endpoint: "suppressed_aggregate_report",
    dataClasses: ["deidentified_aggregate_metrics"],
    statedPurpose: "aggregate_analysis_reporting",
    recipient: "authorized_aggregate_recipients",
    recipientProfileRequired: false,
    audience: "suppressed_aggregate_only",
    control: "participant_analysis_inclusion",
    processorDisclosure: null,
    zeroDataRetentionControl: null,
  },
} as const satisfies Record<ConsentPurpose, ConsentContract>
