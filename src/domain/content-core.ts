import { z } from "zod"
import {
  FeedbackApprovalIdSchema,
  FeedbackDraftIdSchema,
  MembershipIdSchema,
  NoticeIdSchema,
  ProgramInstanceIdSchema,
} from "./ids"
import { IsoDateTimeSchema, NonEmptyTextSchema } from "./values"

export const ContentIdSchema = z.union([
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
export function plusDays(
  value: z.infer<typeof IsoDateTimeSchema>,
  days: number,
): z.infer<typeof IsoDateTimeSchema> {
  const date = new Date(value)
  date.setUTCDate(date.getUTCDate() + days)
  return IsoDateTimeSchema.parse(date.toISOString())
}
export const purgeMatches = (
  deletedAt: z.infer<typeof IsoDateTimeSchema> | null | undefined,
  purgeAfter: z.infer<typeof IsoDateTimeSchema> | null | undefined,
) =>
  deletedAt != null &&
  purgeAfter != null &&
  Date.parse(purgeAfter) === Date.parse(plusDays(deletedAt, 30))

const feedbackBase = {
  id: FeedbackDraftIdSchema,
  participantId: MembershipIdSchema,
  origin: z.enum(["automated", "coach"]),
  body: NonEmptyTextSchema.max(4_000),
  createdAt: IsoDateTimeSchema,
} as const

export const FeedbackDraftSchema = z.discriminatedUnion("risk", [
  z
    .object({ ...feedbackBase, risk: z.literal("low"), approval: z.literal("not_required") })
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
