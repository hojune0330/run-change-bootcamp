import { z } from "zod"

export const DemoParticipantIdSchema = z.templateLiteral([
  "participant-",
  z.string().regex(/^\d{2}$/),
])
export type DemoParticipantId = z.infer<typeof DemoParticipantIdSchema>

const SessionSchema = z
  .discriminatedUnion("role", [
    z.object({ role: z.literal("participant"), participantId: DemoParticipantIdSchema }).strict(),
    z.object({ role: z.literal("coach") }).strict(),
    z.object({ role: z.literal("admin") }).strict(),
  ])
  .nullable()

const AssignmentSchema = z
  .object({
    id: z.templateLiteral(["assignment-", z.string().min(1)]),
    title: z.string().trim().min(1),
    summary: z.string().trim().min(1),
    dueDate: z.iso.date(),
    category: z.enum(["running", "health"]),
  })
  .strict()
  .readonly()

const NoticeSchema = z
  .object({
    id: z.templateLiteral(["announcement-", z.string().min(1)]),
    title: z.string().trim().min(1),
    body: z.string().trim().min(1),
    pinned: z.boolean(),
  })
  .strict()
  .readonly()

const CommentSchema = z
  .object({
    id: z.templateLiteral(["comment-", z.string().min(1)]),
    authorId: DemoParticipantIdSchema,
    body: z.string().trim().min(1),
  })
  .strict()
  .readonly()

const PostSchema = z
  .object({
    id: z.templateLiteral(["post-", z.string().min(1)]),
    authorId: DemoParticipantIdSchema,
    body: z.string().trim().min(1),
    createdLabel: z.string().trim().min(1),
    baseHeartCount: z.number().int().nonnegative(),
    heartedBy: z.array(DemoParticipantIdSchema).readonly(),
    comments: z.array(CommentSchema).readonly(),
  })
  .strict()
  .readonly()

const MetricSchema = z
  .object({
    id: z.templateLiteral(["metric-", z.string().min(1)]),
    participantId: DemoParticipantIdSchema,
    label: z.string().trim().min(1),
    value: z.string().trim().min(1),
    changeLabel: z.string().trim().min(1),
    source: z.enum(["manual", "file", "screenshot"]),
  })
  .strict()
  .readonly()

const DraftSchema = z
  .object({
    id: z.templateLiteral(["draft-", z.string().min(1)]),
    participantId: DemoParticipantIdSchema,
    source: z.enum(["file", "screenshot"]),
    sourceLabel: z.string().trim().min(1),
    metrics: z
      .array(
        z
          .object({ label: z.string().min(1), value: z.string().min(1) })
          .strict()
          .readonly(),
      )
      .readonly(),
    notes: z.array(z.string().trim().min(1)).readonly(),
    status: z.enum(["pending", "saved"]),
  })
  .strict()
  .readonly()

const ConsentEventSchema = z
  .object({
    id: z.templateLiteral(["audit-", z.string().min(1)]),
    participantId: DemoParticipantIdSchema,
    kind: z.enum(["granted", "revoked"]),
    label: z.string().trim().min(1),
  })
  .strict()
  .readonly()

const DeliveredFeedbackSchema = z
  .object({
    id: z.templateLiteral(["feedback-", z.string().min(1)]),
    participantId: DemoParticipantIdSchema,
    source: z.enum(["automated_summary", "coach_approved"]),
    title: z.string().trim().min(1),
    body: z.string().trim().min(1),
  })
  .strict()
  .readonly()

const ActivityActorSchema = z.enum(["coach", "admin"])
const ActivityActionSchema = z.enum([
  "assignment_publish",
  "notice_publish",
  "feedback_approve",
  "feedback_reject",
  "time_trial_save",
])
const ActivityLogEntrySchema = z
  .object({
    id: z.templateLiteral(["activity-", z.string().min(1)]),
    actor: ActivityActorSchema,
    action: ActivityActionSchema,
    summary: z.string().trim().min(1),
    createdAtLabel: z.string().trim().min(1),
  })
  .strict()
  .readonly()

const FeedbackQueueSchema = z
  .object({
    id: z.templateLiteral(["feedback:", z.string().min(1)]),
    participantId: DemoParticipantIdSchema,
    kind: z.enum(["low_risk", "training_change", "pain_risk"]),
    summary: z.string().trim().min(1),
    createdAtLabel: z.string().trim().min(1),
  })
  .strict()
  .readonly()

const AssignmentDraftSchema = z
  .object({
    title: z.string(),
    category: z.enum(["running", "health"]),
    dueDate: z.string(),
    cohortId: z.union([z.literal("all"), z.templateLiteral(["cohort:", z.string().min(1)])]),
    instructions: z.string(),
  })
  .strict()
  .readonly()

const NoticeDraftSchema = z
  .object({ title: z.string(), body: z.string(), pinned: z.boolean() })
  .strict()
  .readonly()

const TimeTrialDecisionSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("undecided") })
    .strict()
    .readonly(),
  z
    .object({
      kind: z.literal("decided"),
      session: z.enum(["session_1", "session_2"]),
      protocol: z.enum(["12_minute", "3k", "5k"]),
    })
    .strict()
    .readonly(),
])

export const DemoStateSchema = z
  .object({
    session: SessionSchema,
    assignments: z.array(AssignmentSchema).min(1).readonly(),
    notices: z.array(NoticeSchema).min(1).readonly(),
    completions: z
      .array(
        z
          .object({
            participantId: DemoParticipantIdSchema,
            assignmentId: z.templateLiteral(["assignment-", z.string().min(1)]),
          })
          .strict()
          .readonly(),
      )
      .readonly(),
    posts: z.array(PostSchema).readonly(),
    metrics: z.array(MetricSchema).readonly(),
    drafts: z.array(DraftSchema).readonly(),
    consentedParticipants: z.array(DemoParticipantIdSchema).readonly(),
    revokedParticipants: z.array(DemoParticipantIdSchema).readonly(),
    consentEvents: z.array(ConsentEventSchema).readonly(),
    activityLog: z.array(ActivityLogEntrySchema).readonly(),
    deliveredFeedback: z.array(DeliveredFeedbackSchema).readonly(),
    feedbackQueue: z.array(FeedbackQueueSchema).readonly(),
    coachQuery: z.string(),
    coachCohortId: z.union([z.literal("all"), z.templateLiteral(["cohort:", z.string().min(1)])]),
    selectedParticipantId: DemoParticipantIdSchema.nullable(),
    assignmentDraft: AssignmentDraftSchema,
    noticeDraft: NoticeDraftSchema,
    timeTrialDecision: TimeTrialDecisionSchema,
    timeTrialDraft: z
      .object({
        session: z.enum(["session_1", "session_2"]).nullable(),
        protocol: z.enum(["12_minute", "3k", "5k"]).nullable(),
      })
      .strict()
      .readonly(),
    timeTrialConfirmation: z.enum(["idle", "required"]),
    sequence: z.number().int().positive(),
  })
  .strict()
  .readonly()

export type DemoState = z.infer<typeof DemoStateSchema>
export type DemoSession = DemoState["session"]
export type DemoDraft = DemoState["drafts"][number]
export type ActivityActor = z.infer<typeof ActivityActorSchema>
export type ActivityAction = z.infer<typeof ActivityActionSchema>
export type ActivityLogEntry = z.infer<typeof ActivityLogEntrySchema>

export const DemoEnvelopeSchema = z
  .object({ version: z.literal(1), state: DemoStateSchema })
  .strict()
  .readonly()
export type DemoEnvelope = z.infer<typeof DemoEnvelopeSchema>
