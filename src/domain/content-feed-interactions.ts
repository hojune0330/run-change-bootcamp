import { z } from "zod"
import { ContentIdSchema, DateTimeOrNull, purgeMatches } from "./content-core"
import {
  FeedAudiencePreviewSchema,
  FeedDeleteStateSchema,
  FeedModerationStateSchema,
} from "./content-feed-post"
import { CommentIdSchema, FeedPostIdSchema, MembershipIdSchema, ReactionIdSchema } from "./ids"
import { IsoDateTimeSchema, NonEmptyTextSchema } from "./values"

const FeedCommentShape = z
  .object({
    id: CommentIdSchema,
    postId: FeedPostIdSchema,
    authorId: ContentIdSchema.optional(),
    authorProfileId: ContentIdSchema.optional(),
    body: NonEmptyTextSchema.max(1_000),
    contentOrigin: z.literal("social").default("social"),
    contentSensitivity: z.literal("nonsensitive").default("nonsensitive"),
    editedAt: DateTimeOrNull,
    moderationState: FeedModerationStateSchema.default("visible"),
    moderatedByProfileId: ContentIdSchema.nullable().optional(),
    moderatedAt: DateTimeOrNull,
    moderationReasonCode: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/^[a-z][a-z0-9_]{2,79}$/)
      .nullable()
      .optional(),
    deleteState: FeedDeleteStateSchema.default("active"),
    deletedAt: DateTimeOrNull,
    purgeAfter: DateTimeOrNull,
    purgedAt: DateTimeOrNull,
    createdAt: IsoDateTimeSchema,
  })
  .strict()
  .readonly()
export const CommentSchema = FeedCommentShape.superRefine((comment, context) => {
  if (comment.authorId === undefined && comment.authorProfileId === undefined)
    context.addIssue({
      code: "custom",
      path: ["authorProfileId"],
      message: "comment author is required",
    })
  if (comment.authorId !== undefined && comment.authorProfileId !== undefined)
    context.addIssue({
      code: "custom",
      path: ["authorProfileId"],
      message: "choose one author identifier",
    })
  if (
    comment.moderationState === "visible" &&
    (comment.moderatedByProfileId != null ||
      comment.moderatedAt != null ||
      comment.moderationReasonCode != null)
  )
    context.addIssue({
      code: "custom",
      path: ["moderationState"],
      message: "visible comments have no moderation metadata",
    })
  if (
    comment.moderationState !== "visible" &&
    (comment.moderatedByProfileId == null ||
      comment.moderatedAt == null ||
      comment.moderationReasonCode == null)
  )
    context.addIssue({
      code: "custom",
      path: ["moderationState"],
      message: "moderated comments require reviewer metadata",
    })
  if (
    comment.deleteState === "active" &&
    (comment.deletedAt != null || comment.purgeAfter != null || comment.purgedAt != null)
  )
    context.addIssue({
      code: "custom",
      path: ["deleteState"],
      message: "active comment has no deletion metadata",
    })
  if (
    comment.deleteState === "soft_deleted" &&
    (comment.deletedAt == null ||
      comment.purgeAfter == null ||
      comment.purgedAt != null ||
      !purgeMatches(comment.deletedAt, comment.purgeAfter))
  )
    context.addIssue({
      code: "custom",
      path: ["deleteState"],
      message: "soft-deleted comment requires the exact purge deadline",
    })
  if (
    comment.deleteState === "purged" &&
    (comment.deletedAt == null ||
      comment.purgeAfter == null ||
      comment.purgedAt == null ||
      !purgeMatches(comment.deletedAt, comment.purgeAfter) ||
      Date.parse(comment.purgedAt) < Date.parse(comment.purgeAfter ?? comment.purgedAt))
  )
    context.addIssue({
      code: "custom",
      path: ["deleteState"],
      message: "purged comment requires completed purge metadata",
    })
})
export type Comment = z.infer<typeof CommentSchema>
export const FeedCommentSchema = CommentSchema
export type FeedComment = z.infer<typeof FeedCommentSchema>

export const ReactionSchema = z
  .object({
    id: ReactionIdSchema,
    postId: FeedPostIdSchema,
    memberId: MembershipIdSchema,
    kind: z.literal("heart"),
    createdAt: IsoDateTimeSchema,
  })
  .strict()
  .readonly()
export type Reaction = z.infer<typeof ReactionSchema>
export const FeedReactionSchema = z
  .object({
    postId: FeedPostIdSchema,
    authorProfileId: ContentIdSchema,
    reaction: z.literal("heart").default("heart"),
    createdAt: IsoDateTimeSchema,
  })
  .strict()
  .readonly()
export type FeedReaction = z.infer<typeof FeedReactionSchema>

export const FeedShareEventSchema = z
  .object({
    id: z.number().int().positive(),
    postId: FeedPostIdSchema,
    actorProfileId: ContentIdSchema,
    shareMethod: z.enum(["native", "clipboard"]),
    audiencePreview: FeedAudiencePreviewSchema,
    createdAt: IsoDateTimeSchema,
  })
  .strict()
  .readonly()
export type FeedShareEvent = z.infer<typeof FeedShareEventSchema>
