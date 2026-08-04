import { z } from "zod"
import { IsoDateSchema, IsoDateTimeSchema } from "./values"

const PersistedUuidSchema = z.uuid()
const NotificationChannelSchema = z.enum(["in_app", "push"])

export const NotificationPreferenceSchema = z
  .object({
    participantProfileId: PersistedUuidSchema,
    timezone: z.literal("Asia/Seoul"),
    quietStartsAt: z.literal("21:00"),
    quietEndsAt: z.literal("08:00"),
    nonurgentDailyCap: z.literal(3),
    digest: z.enum(["off", "daily"]),
    channels: z.array(NotificationChannelSchema).min(1).max(2).readonly(),
  })
  .strict()
  .refine((preference) => new Set(preference.channels).size === preference.channels.length)
  .readonly()

export type NotificationEvent = {
  readonly id: string
  readonly recipientId: string
  readonly localDay: string
  readonly scheduledAt: string
  readonly urgency: "urgent" | "nonurgent"
}

const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1_000

function getSeoulSchedule(value: string): {
  readonly localDay: string
  readonly minuteOfDay: number
} {
  const seoulInstant = new Date(Date.parse(value) + SEOUL_OFFSET_MS)
  return {
    localDay: seoulInstant.toISOString().slice(0, 10),
    minuteOfDay: seoulInstant.getUTCHours() * 60 + seoulInstant.getUTCMinutes(),
  }
}

export function evaluateNotificationSchedule(
  existingEvents: readonly NotificationEvent[],
  event: NotificationEvent,
) {
  if (
    !IsoDateSchema.safeParse(event.localDay).success ||
    !IsoDateTimeSchema.safeParse(event.scheduledAt).success
  ) {
    return { allowed: false, reason: "invalid_schedule" }
  }
  const schedule = getSeoulSchedule(event.scheduledAt)
  if (schedule.localDay !== event.localDay) {
    return { allowed: false, reason: "invalid_schedule" }
  }
  if (event.urgency === "urgent") return { allowed: true }

  if (schedule.minuteOfDay >= 21 * 60 || schedule.minuteOfDay < 8 * 60) {
    return { allowed: false, reason: "quiet_hours" }
  }

  const countedEventIds = new Set(
    existingEvents
      .filter(
        (existing) =>
          existing.recipientId === event.recipientId &&
          existing.localDay === event.localDay &&
          existing.urgency === "nonurgent",
      )
      .map((existing) => existing.id),
  )
  return countedEventIds.size >= 3
    ? { allowed: false, reason: "daily_cap_reached" }
    : { allowed: true }
}

export const NotificationDeliverySchema = z
  .object({
    id: PersistedUuidSchema,
    notificationId: PersistedUuidSchema,
    channel: NotificationChannelSchema,
    status: z.enum(["pending", "processing", "sent", "failed", "cancelled"]),
    attemptCount: z.number().int().nonnegative().max(10),
    sentAt: IsoDateTimeSchema.optional(),
    lastErrorCode: z.string().trim().min(1).max(80).optional(),
  })
  .strict()
  .readonly()

function occursWithin(start: string, end: string, milliseconds: number): boolean {
  const elapsed = Date.parse(end) - Date.parse(start)
  return elapsed >= 0 && elapsed <= milliseconds
}

export const AccountDeletionJobSchema = z
  .object({
    id: PersistedUuidSchema,
    status: z.enum(["requested", "processing", "retrying", "completed", "cancelled", "failed"]),
    phase: z.enum(["storage_live", "database_live", "auth_identity", "backup_vendor_tombstone"]),
    requestedAt: IsoDateTimeSchema,
    storageDeletedAt: IsoDateTimeSchema.optional(),
    databaseDeletedAt: IsoDateTimeSchema.optional(),
    authDeletedAt: IsoDateTimeSchema.optional(),
    backupVendorTombstoneDueAt: IsoDateTimeSchema,
    backupVendorTombstoneRecordedAt: IsoDateTimeSchema.optional(),
    retryCount: z.number().int().nonnegative().max(20),
    nextRetryAt: IsoDateTimeSchema.optional(),
    alertState: z.enum(["none", "warning", "escalated"]),
  })
  .strict()
  .superRefine((job, context) => {
    const requireField = (present: boolean, path: string) => {
      if (!present)
        context.addIssue({ code: "custom", path: [path], message: `${path} is required` })
    }
    if (job.phase !== "storage_live")
      requireField(Boolean(job.storageDeletedAt), "storageDeletedAt")
    if (["auth_identity", "backup_vendor_tombstone"].includes(job.phase)) {
      requireField(Boolean(job.databaseDeletedAt), "databaseDeletedAt")
    }
    if (job.phase === "backup_vendor_tombstone" || job.status === "completed") {
      requireField(Boolean(job.authDeletedAt), "authDeletedAt")
    }
    if (job.status === "completed") {
      requireField(Boolean(job.backupVendorTombstoneRecordedAt), "backupVendorTombstoneRecordedAt")
    }
    if (
      job.storageDeletedAt &&
      !occursWithin(job.requestedAt, job.storageDeletedAt, 24 * 60 * 60 * 1_000)
    ) {
      context.addIssue({
        code: "custom",
        path: ["storageDeletedAt"],
        message: "live Storage exceeds 24 hours",
      })
    }
    if (
      job.databaseDeletedAt &&
      (!job.storageDeletedAt ||
        Date.parse(job.databaseDeletedAt) < Date.parse(job.storageDeletedAt) ||
        !occursWithin(job.requestedAt, job.databaseDeletedAt, 7 * 24 * 60 * 60 * 1_000))
    ) {
      context.addIssue({
        code: "custom",
        path: ["databaseDeletedAt"],
        message: "database deletion is out of order",
      })
    }
    if (
      job.authDeletedAt &&
      (!job.databaseDeletedAt ||
        !occursWithin(job.databaseDeletedAt, job.authDeletedAt, 15 * 60 * 1_000))
    ) {
      context.addIssue({
        code: "custom",
        path: ["authDeletedAt"],
        message: "Auth must follow database deletion",
      })
    }
    if (!occursWithin(job.requestedAt, job.backupVendorTombstoneDueAt, 30 * 24 * 60 * 60 * 1_000)) {
      context.addIssue({
        code: "custom",
        path: ["backupVendorTombstoneDueAt"],
        message: "tombstone exceeds 30 days",
      })
    }
    if (
      job.backupVendorTombstoneRecordedAt &&
      (!job.authDeletedAt ||
        Date.parse(job.backupVendorTombstoneRecordedAt) < Date.parse(job.authDeletedAt) ||
        Date.parse(job.backupVendorTombstoneRecordedAt) >
          Date.parse(job.backupVendorTombstoneDueAt))
    ) {
      context.addIssue({
        code: "custom",
        path: ["backupVendorTombstoneRecordedAt"],
        message: "vendor tombstone is out of order or late",
      })
    }
  })
  .readonly()

export const ScreenshotDraftJobSchema = z
  .object({
    id: PersistedUuidSchema,
    participantProfileId: PersistedUuidSchema,
    consentGrantId: PersistedUuidSchema,
    attestationId: PersistedUuidSchema,
    status: z.enum(["processing", "succeeded", "failed"]),
    createdAt: IsoDateTimeSchema,
    completedAt: IsoDateTimeSchema.optional(),
    metadataExpiresAt: IsoDateTimeSchema,
    errorCode: z.string().trim().min(1).max(80).optional(),
  })
  .strict()
  .superRefine((job, context) => {
    const terminal = job.status !== "processing"
    if (!terminal && job.completedAt) {
      context.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "processing jobs cannot be completed",
      })
    }
    if (terminal && !job.completedAt) {
      context.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "terminal jobs require completedAt",
      })
      return
    }
    if ((job.status === "failed") !== Boolean(job.errorCode)) {
      context.addIssue({
        code: "custom",
        path: ["errorCode"],
        message: "only failed jobs carry an errorCode",
      })
    }
    const startsAt = job.status === "succeeded" ? (job.completedAt ?? job.createdAt) : job.createdAt
    const limit = job.status === "succeeded" ? 24 * 60 * 60 * 1_000 : 7 * 24 * 60 * 60 * 1_000
    if (!occursWithin(startsAt, job.metadataExpiresAt, limit)) {
      context.addIssue({
        code: "custom",
        path: ["metadataExpiresAt"],
        message: "metadata retention exceeded",
      })
    }
  })
  .readonly()
