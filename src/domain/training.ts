import { z } from "zod"
import {
  ActivityIdSchema,
  AssignmentIdSchema,
  MembershipIdSchema,
  ProgramInstanceIdSchema,
  SubmissionIdSchema,
} from "./ids"
import {
  IsoDateTimeSchema,
  NonEmptyTextSchema,
  PositiveMetersSchema,
  PositiveSecondsSchema,
} from "./values"

const assignmentBase = {
  id: AssignmentIdSchema,
  programId: ProgramInstanceIdSchema,
  title: NonEmptyTextSchema.max(160),
  kind: z.enum(["running", "health", "reflection"]),
  dueAt: IsoDateTimeSchema,
} as const

const DraftAssignmentSchema = z
  .object({ ...assignmentBase, status: z.literal("draft") })
  .strict()
  .readonly()
const PublishedAssignmentSchema = z
  .object({
    ...assignmentBase,
    status: z.literal("published"),
    publishedAt: IsoDateTimeSchema,
  })
  .strict()
  .readonly()
const ClosedAssignmentSchema = z
  .object({
    ...assignmentBase,
    status: z.literal("closed"),
    publishedAt: IsoDateTimeSchema,
    closedAt: IsoDateTimeSchema,
  })
  .strict()
  .readonly()

export const AssignmentSchema = z.discriminatedUnion("status", [
  DraftAssignmentSchema,
  PublishedAssignmentSchema,
  ClosedAssignmentSchema,
])
export type Assignment = z.infer<typeof AssignmentSchema>

const submissionBase = {
  id: SubmissionIdSchema,
  assignmentId: AssignmentIdSchema,
  participantId: MembershipIdSchema,
  note: NonEmptyTextSchema.max(2_000).optional(),
  activityId: ActivityIdSchema.optional(),
} as const

export const SubmissionSchema = z.discriminatedUnion("status", [
  z
    .object({ ...submissionBase, status: z.literal("draft") })
    .strict()
    .readonly(),
  z
    .object({
      ...submissionBase,
      status: z.literal("submitted"),
      submittedAt: IsoDateTimeSchema,
    })
    .strict()
    .readonly(),
  z
    .object({
      ...submissionBase,
      status: z.literal("reviewed"),
      submittedAt: IsoDateTimeSchema,
      reviewedAt: IsoDateTimeSchema,
    })
    .strict()
    .readonly(),
])
export type Submission = z.infer<typeof SubmissionSchema>

export const ActivitySchema = z
  .object({
    id: ActivityIdSchema,
    participantId: MembershipIdSchema,
    source: z.enum(["manual", "import", "screenshot"]),
    status: z.enum(["draft", "confirmed"]),
    occurredAt: IsoDateTimeSchema,
    distanceMeters: PositiveMetersSchema.optional(),
    durationSeconds: PositiveSecondsSchema.optional(),
  })
  .strict()
  .refine(
    (activity) => activity.distanceMeters !== undefined || activity.durationSeconds !== undefined,
    { message: "activity needs distance or duration" },
  )
  .readonly()
export type Activity = z.infer<typeof ActivitySchema>
