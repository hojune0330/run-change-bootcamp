import { z } from "zod"
import {
  CommentIdSchema,
  FeedbackApprovalIdSchema,
  FeedbackDraftIdSchema,
  FeedPostIdSchema,
  MembershipIdSchema,
  NoticeIdSchema,
  NotificationIdSchema,
  ProgramInstanceIdSchema,
  ReactionIdSchema,
} from "./ids"
import { IsoDateTimeSchema, NonEmptyTextSchema } from "./values"

const feedbackBase = {
  id: FeedbackDraftIdSchema,
  participantId: MembershipIdSchema,
  origin: z.enum(["automated", "coach"]),
  body: NonEmptyTextSchema.max(4_000),
  createdAt: IsoDateTimeSchema,
} as const

export const FeedbackDraftSchema = z.discriminatedUnion("risk", [
  z
    .object({
      ...feedbackBase,
      risk: z.literal("low"),
      approval: z.literal("not_required"),
    })
    .strict()
    .readonly(),
  z
    .object({
      ...feedbackBase,
      risk: z.literal("training_change"),
      approval: z.literal("required"),
    })
    .strict()
    .readonly(),
  z
    .object({ ...feedbackBase, risk: z.literal("pain"), approval: z.literal("required") })
    .strict()
    .readonly(),
  z
    .object({ ...feedbackBase, risk: z.literal("risk"), approval: z.literal("required") })
    .strict()
    .readonly(),
])
export type FeedbackDraft = z.infer<typeof FeedbackDraftSchema>

export const FeedbackApprovalSchema = z
  .object({
    id: FeedbackApprovalIdSchema,
    draftId: FeedbackDraftIdSchema,
    coachId: MembershipIdSchema,
    decision: z.enum(["approved", "rejected"]),
    decidedAt: IsoDateTimeSchema,
    note: NonEmptyTextSchema.max(2_000).optional(),
  })
  .strict()
  .readonly()
export type FeedbackApproval = z.infer<typeof FeedbackApprovalSchema>

export const NoticeSchema = z
  .object({
    id: NoticeIdSchema,
    programId: ProgramInstanceIdSchema,
    authorId: MembershipIdSchema,
    title: NonEmptyTextSchema.max(160),
    body: NonEmptyTextSchema,
    audience: z.enum(["participants", "coaches", "all"]),
    publishedAt: IsoDateTimeSchema,
  })
  .strict()
  .readonly()
export type Notice = z.infer<typeof NoticeSchema>

export const FeedPostSchema = z
  .object({
    id: FeedPostIdSchema,
    programId: ProgramInstanceIdSchema,
    authorId: MembershipIdSchema,
    kind: z.enum(["assignment_completion", "reflection", "coach_update"]),
    body: NonEmptyTextSchema.max(2_000),
    createdAt: IsoDateTimeSchema,
  })
  .strict()
  .readonly()
export type FeedPost = z.infer<typeof FeedPostSchema>

export const CommentSchema = z
  .object({
    id: CommentIdSchema,
    postId: FeedPostIdSchema,
    authorId: MembershipIdSchema,
    body: NonEmptyTextSchema.max(1_000),
    createdAt: IsoDateTimeSchema,
  })
  .strict()
  .readonly()
export type Comment = z.infer<typeof CommentSchema>

export const ReactionSchema = z
  .object({
    id: ReactionIdSchema,
    postId: FeedPostIdSchema,
    memberId: MembershipIdSchema,
    kind: z.enum(["heart", "cheer"]),
    createdAt: IsoDateTimeSchema,
  })
  .strict()
  .readonly()
export type Reaction = z.infer<typeof ReactionSchema>

export const NotificationSchema = z
  .object({
    id: NotificationIdSchema,
    recipientId: MembershipIdSchema,
    kind: z.enum(["assignment", "comment", "feedback", "notice", "reminder"]),
    title: NonEmptyTextSchema.max(160),
    body: NonEmptyTextSchema.max(1_000),
    createdAt: IsoDateTimeSchema,
    readAt: IsoDateTimeSchema.optional(),
  })
  .strict()
  .readonly()
export type Notification = z.infer<typeof NotificationSchema>
