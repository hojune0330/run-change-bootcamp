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
export function plusDays(
  value: z.infer<typeof IsoDateTimeSchema>,
  days: number,
): z.infer<typeof IsoDateTimeSchema> {
  const date = new Date(value)
  date.setUTCDate(date.getUTCDate() + days)
  return IsoDateTimeSchema.parse(date.toISOString())
}
const ThreadOriginSchema = z.enum(["general", "training", "health", "reflection", "pain"])
const ThreadStatusSchema = z.enum(["open", "closed", "archived", "deleted"])
export const RoutingStatusSchema = z.enum(["unanswered", "answered", "needs_followup"])
const LifecycleFields = {
  closedAt: DateTimeOrNull,
  closedByProfileId: ProfileRefOrNull.optional(),
  archivedAt: DateTimeOrNull,
  archivedByProfileId: ProfileRefOrNull.optional(),
  deletedAt: DateTimeOrNull,
  deletedByProfileId: ProfileRefOrNull.optional(),
  purgeAfter: DateTimeOrNull,
} as const
export const allPresent = (values: readonly unknown[]) => values.every((value) => value != null)
export const anyPresent = (values: readonly unknown[]) => values.some((value) => value != null)
export const purgeMatches = (
  deletedAt: z.infer<typeof IsoDateTimeSchema> | null | undefined,
  purgeAfter: z.infer<typeof IsoDateTimeSchema> | null | undefined,
) =>
  deletedAt != null &&
  purgeAfter != null &&
  Date.parse(purgeAfter) === Date.parse(plusDays(deletedAt, 30))

export const PrivateQuestionThreadSchema = z
  .object({
    id: PrivacyIdSchema,
    programId: ProgramRefSchema,
    participantProfileId: PrivacyIdSchema,
    questionBody: z.string().trim().min(1).max(5_000),
    contentOrigin: ThreadOriginSchema,
    contentSensitivity: z.enum(["private", "sensitive"]),
    visibility: z.literal("private").default("private"),
    status: ThreadStatusSchema.default("open"),
    routingStatus: RoutingStatusSchema.default("unanswered"),
    ...LifecycleFields,
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict()
  .readonly()
  .superRefine((thread, context) => {
    const expectedSensitivity = ["health", "reflection", "pain"].includes(thread.contentOrigin)
      ? "sensitive"
      : "private"
    if (thread.contentSensitivity !== expectedSensitivity)
      context.addIssue({
        code: "custom",
        path: ["contentSensitivity"],
        message: "sensitivity is database-derived",
      })
    const closure = [thread.closedAt, thread.closedByProfileId]
    const archive = [thread.archivedAt, thread.archivedByProfileId]
    const deletion = [thread.deletedAt, thread.deletedByProfileId, thread.purgeAfter]
    if (anyPresent(closure) && !allPresent(closure))
      context.addIssue({
        code: "custom",
        path: ["closedAt"],
        message: "closure metadata must be complete",
      })
    if (thread.status === "closed" && !allPresent(closure))
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "closed thread requires closure metadata",
      })
    if (thread.status === "open" && anyPresent(closure))
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "only closed, archived, or deleted threads retain closure metadata",
      })
    if (thread.status === "archived" && !allPresent(archive))
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "archived thread requires archive metadata",
      })
    if (thread.status !== "archived" && anyPresent(archive))
      context.addIssue({
        code: "custom",
        path: ["archivedAt"],
        message: "only archived threads have archive metadata",
      })
    if (
      thread.status === "deleted" &&
      (!allPresent(deletion) || !purgeMatches(thread.deletedAt, thread.purgeAfter))
    )
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "deleted thread requires exact purge metadata",
      })
    if (thread.status !== "deleted" && anyPresent(deletion))
      context.addIssue({
        code: "custom",
        path: ["deletedAt"],
        message: "only deleted threads have deletion metadata",
      })
  })
export type PrivateQuestionThread = z.infer<typeof PrivateQuestionThreadSchema>

export const PrivateQuestionAnswerSchema = z
  .object({
    id: PrivacyIdSchema,
    threadId: PrivacyIdSchema,
    programId: ProgramRefSchema,
    authorProfileId: PrivacyIdSchema,
    answerBody: z.string().trim().min(1).max(5_000),
    visibility: z.literal("private").default("private"),
    status: z.enum(["active", "deleted"]).default("active"),
    deletedAt: DateTimeOrNull,
    deletedByProfileId: ProfileRefOrNull.optional(),
    purgeAfter: DateTimeOrNull,
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict()
  .readonly()
  .superRefine((answer, context) => {
    const deleted = [answer.deletedAt, answer.deletedByProfileId, answer.purgeAfter]
    if (answer.status === "active" && anyPresent(deleted))
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "active answer cannot contain deletion metadata",
      })
    if (
      answer.status === "deleted" &&
      (!allPresent(deleted) || !purgeMatches(answer.deletedAt, answer.purgeAfter))
    )
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "deleted answer requires exact purge metadata",
      })
  })
export type PrivateQuestionAnswer = z.infer<typeof PrivateQuestionAnswerSchema>
