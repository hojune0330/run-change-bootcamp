import { z } from "zod"

const entityId = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(/^[a-z][a-z0-9-]*$/)

export const OrganizationIdSchema = entityId.brand<"OrganizationId">()
export type OrganizationId = z.infer<typeof OrganizationIdSchema>

export const ProgramTemplateIdSchema = entityId.brand<"ProgramTemplateId">()
export type ProgramTemplateId = z.infer<typeof ProgramTemplateIdSchema>

export const ProgramInstanceIdSchema = entityId.brand<"ProgramInstanceId">()
export type ProgramInstanceId = z.infer<typeof ProgramInstanceIdSchema>

export const UserIdSchema = entityId.brand<"UserId">()
export type UserId = z.infer<typeof UserIdSchema>

export const MembershipIdSchema = entityId.brand<"MembershipId">()
export type MembershipId = z.infer<typeof MembershipIdSchema>

export const AssignmentIdSchema = entityId.brand<"AssignmentId">()
export type AssignmentId = z.infer<typeof AssignmentIdSchema>

export const SubmissionIdSchema = entityId.brand<"SubmissionId">()
export type SubmissionId = z.infer<typeof SubmissionIdSchema>

export const ActivityIdSchema = entityId.brand<"ActivityId">()
export type ActivityId = z.infer<typeof ActivityIdSchema>

export const HealthMetricIdSchema = entityId.brand<"HealthMetricId">()
export type HealthMetricId = z.infer<typeof HealthMetricIdSchema>

export const AssessmentSessionIdSchema = entityId.brand<"AssessmentSessionId">()
export type AssessmentSessionId = z.infer<typeof AssessmentSessionIdSchema>

export const AssessmentProtocolVersionIdSchema = entityId.brand<"AssessmentProtocolVersionId">()
export type AssessmentProtocolVersionId = z.infer<typeof AssessmentProtocolVersionIdSchema>

export const EnrollmentIdSchema = entityId.brand<"EnrollmentId">()
export type EnrollmentId = z.infer<typeof EnrollmentIdSchema>

export const AssessmentAttemptIdSchema = entityId.brand<"AssessmentAttemptId">()
export type AssessmentAttemptId = z.infer<typeof AssessmentAttemptIdSchema>

export const AssessmentResultIdSchema = entityId.brand<"AssessmentResultId">()
export type AssessmentResultId = z.infer<typeof AssessmentResultIdSchema>

export const ImportArtifactIdSchema = entityId.brand<"ImportArtifactId">()
export type ImportArtifactId = z.infer<typeof ImportArtifactIdSchema>

export const MetricDraftIdSchema = entityId.brand<"MetricDraftId">()
export type MetricDraftId = z.infer<typeof MetricDraftIdSchema>

export const FeedbackDraftIdSchema = entityId.brand<"FeedbackDraftId">()
export type FeedbackDraftId = z.infer<typeof FeedbackDraftIdSchema>

export const FeedbackApprovalIdSchema = entityId.brand<"FeedbackApprovalId">()
export type FeedbackApprovalId = z.infer<typeof FeedbackApprovalIdSchema>

export const NoticeIdSchema = entityId.brand<"NoticeId">()
export type NoticeId = z.infer<typeof NoticeIdSchema>

export const FeedPostIdSchema = entityId.brand<"FeedPostId">()
export type FeedPostId = z.infer<typeof FeedPostIdSchema>

export const CommentIdSchema = entityId.brand<"CommentId">()
export type CommentId = z.infer<typeof CommentIdSchema>

export const ReactionIdSchema = entityId.brand<"ReactionId">()
export type ReactionId = z.infer<typeof ReactionIdSchema>

export const NotificationIdSchema = entityId.brand<"NotificationId">()
export type NotificationId = z.infer<typeof NotificationIdSchema>

export const ConsentGrantIdSchema = entityId.brand<"ConsentGrantId">()
export type ConsentGrantId = z.infer<typeof ConsentGrantIdSchema>

export const ConsentRevocationIdSchema = entityId.brand<"ConsentRevocationId">()
export type ConsentRevocationId = z.infer<typeof ConsentRevocationIdSchema>

export const AuditEventIdSchema = entityId.brand<"AuditEventId">()
export type AuditEventId = z.infer<typeof AuditEventIdSchema>
