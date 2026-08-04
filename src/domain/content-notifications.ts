import { z } from "zod"
import { ContentIdSchema, DateTimeOrNull, ProgramRefSchema } from "./content-core"
import { NotificationIdSchema } from "./ids"
import { IsoDateTimeSchema } from "./values"

const NotificationTitleSchema = z.enum([
  "Program assignment update",
  "Program notice available",
  "Coach feedback available",
  "Program reminder",
])
export const NotificationSchema = z
  .object({
    id: NotificationIdSchema,
    recipientProfileId: ContentIdSchema,
    programId: ProgramRefSchema.nullable().optional(),
    category: z.enum(["assignment", "announcement", "feedback", "reminder"]),
    title: NotificationTitleSchema,
    body: z.literal("Open PLUS Run to view this update."),
    containsSensitiveData: z.literal(false).default(false),
    templateKey: z.enum([
      "assignment_update",
      "announcement_available",
      "feedback_available",
      "program_reminder",
    ]),
    audience: z.literal("participant").default("participant"),
    previewKind: z.literal("metadata_only").default("metadata_only"),
    contentSensitivity: z.literal("metadata_only").default("metadata_only"),
    entityType: z.string().trim().min(1).max(80).optional(),
    entityId: ContentIdSchema.nullable().optional(),
    readAt: DateTimeOrNull,
    createdAt: IsoDateTimeSchema,
  })
  .strict()
  .readonly()
  .superRefine((notification, context) => {
    const titleByCategory = {
      assignment: "Program assignment update",
      announcement: "Program notice available",
      feedback: "Coach feedback available",
      reminder: "Program reminder",
    } as const
    const templateByCategory = {
      assignment: "assignment_update",
      announcement: "announcement_available",
      feedback: "feedback_available",
      reminder: "program_reminder",
    } as const
    if (notification.title !== titleByCategory[notification.category])
      context.addIssue({
        code: "custom",
        path: ["title"],
        message: "notification title is metadata-derived",
      })
    if (notification.templateKey !== templateByCategory[notification.category])
      context.addIssue({
        code: "custom",
        path: ["templateKey"],
        message: "notification template is metadata-derived",
      })
  })
export type Notification = z.infer<typeof NotificationSchema>
