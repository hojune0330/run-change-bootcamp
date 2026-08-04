import { z } from "zod"
import { ContentIdSchema, DateTimeOrNull, ProgramRefSchema, purgeMatches } from "./content-core"
import { FeedPostIdSchema, SubmissionIdSchema } from "./ids"
import { IsoDateTimeSchema, NonEmptyTextSchema } from "./values"

export const FeedVisibilitySchema = z.enum(["cohort", "coach_only"])
export const FeedAudiencePreviewSchema = z.enum(["program_cohort", "named_program_staff"])
export const FeedContentOriginSchema = z.enum([
  "social",
  "achievement",
  "health",
  "reflection",
  "pain",
])
export const FeedModerationStateSchema = z.enum(["visible", "hidden", "removed"])
export const FeedDeleteStateSchema = z.enum(["active", "soft_deleted", "purged"])

const FeedPostShape = z
  .object({
    id: FeedPostIdSchema,
    programId: ProgramRefSchema,
    authorId: ContentIdSchema,
    authorProfileId: ContentIdSchema.optional(),
    submissionId: SubmissionIdSchema.nullable().optional(),
    kind: z.enum(["assignment_completion", "reflection", "coach_update"]),
    body: NonEmptyTextSchema.max(2_000),
    visibility: FeedVisibilitySchema.default("cohort"),
    audiencePreview: FeedAudiencePreviewSchema.default("program_cohort"),
    publicationSource: z.enum(["explicit_user", "explicit_staff"]).default("explicit_user"),
    contentOrigin: FeedContentOriginSchema.default("social"),
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

export const FeedPostSchema = FeedPostShape.superRefine((post, context) => {
  const expectedAudience = post.visibility === "cohort" ? "program_cohort" : "named_program_staff"
  if (post.audiencePreview !== expectedAudience)
    context.addIssue({
      code: "custom",
      path: ["audiencePreview"],
      message: "audience preview is database-derived",
    })
  if (["health", "reflection", "pain"].includes(post.contentOrigin))
    context.addIssue({
      code: "custom",
      path: ["contentOrigin"],
      message: "health, reflection, and pain cannot be published",
    })
  if (post.kind === "reflection")
    context.addIssue({
      code: "custom",
      path: ["kind"],
      message: "reflection kind is a sensitive source and cannot be published",
    })
  if (
    post.moderationState === "visible" &&
    (post.moderatedByProfileId != null ||
      post.moderatedAt != null ||
      post.moderationReasonCode != null)
  )
    context.addIssue({
      code: "custom",
      path: ["moderationState"],
      message: "visible content has no moderation metadata",
    })
  if (
    post.moderationState !== "visible" &&
    (post.moderatedByProfileId == null ||
      post.moderatedAt == null ||
      post.moderationReasonCode == null)
  )
    context.addIssue({
      code: "custom",
      path: ["moderationState"],
      message: "moderated content requires reviewer metadata",
    })
  if (
    post.deleteState === "active" &&
    (post.deletedAt != null || post.purgeAfter != null || post.purgedAt != null)
  )
    context.addIssue({
      code: "custom",
      path: ["deleteState"],
      message: "active content has no deletion metadata",
    })
  if (
    post.deleteState === "soft_deleted" &&
    (post.deletedAt == null ||
      post.purgeAfter == null ||
      post.purgedAt != null ||
      !purgeMatches(post.deletedAt, post.purgeAfter))
  )
    context.addIssue({
      code: "custom",
      path: ["deleteState"],
      message: "soft-deleted content requires the exact purge deadline",
    })
  if (
    post.deleteState === "purged" &&
    (post.deletedAt == null ||
      post.purgeAfter == null ||
      post.purgedAt == null ||
      !purgeMatches(post.deletedAt, post.purgeAfter) ||
      Date.parse(post.purgedAt) < Date.parse(post.purgeAfter ?? post.purgedAt))
  )
    context.addIssue({
      code: "custom",
      path: ["deleteState"],
      message: "purged content requires completed purge metadata",
    })
})
export type FeedPost = z.infer<typeof FeedPostSchema>
