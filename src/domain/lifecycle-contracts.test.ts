import { describe, expect, it } from "vitest"
import { FeedbackItemAutomationSchema } from "../integrations/contracts"
import {
  AccountDeletionJobSchema,
  evaluateNotificationSchedule,
  NotificationDeliverySchema,
  NotificationPreferenceSchema,
  ScreenshotDraftJobSchema,
} from "./lifecycle"

const event = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  recipientId: "223e4567-e89b-42d3-a456-426614174000",
  localDay: "2026-08-28",
  scheduledAt: "2026-08-28T09:00:00+09:00",
  urgency: "nonurgent",
} as const

describe("lifecycle automation domain contracts", () => {
  it("locks notification preferences to the tenant quiet-hours and cap contract", () => {
    const valid = {
      participantProfileId: "223e4567-e89b-42d3-a456-426614174000",
      timezone: "Asia/Seoul",
      quietStartsAt: "21:00",
      quietEndsAt: "08:00",
      nonurgentDailyCap: 3,
      digest: "daily",
      channels: ["in_app", "push"],
    }

    const accepted = NotificationPreferenceSchema.safeParse(valid)
    const changedQuietHours = NotificationPreferenceSchema.safeParse({
      ...valid,
      quietStartsAt: "22:00",
    })

    expect(accepted.success).toBe(true)
    expect(changedQuietHours.success).toBe(false)
  })

  it("caps distinct nonurgent logical events", () => {
    const existingEvents = [
      event,
      { ...event, id: "323e4567-e89b-42d3-a456-426614174000" },
      { ...event, id: "423e4567-e89b-42d3-a456-426614174000" },
    ]
    const result = evaluateNotificationSchedule(existingEvents, {
      ...event,
      id: "523e4567-e89b-42d3-a456-426614174000",
    })

    expect(result).toEqual({ allowed: false, reason: "daily_cap_reached" })
  })

  it("treats 21:00 as quiet and 08:00 as deliverable", () => {
    // Given
    const existingEvents: (typeof event)[] = []

    // When
    const atQuietStart = evaluateNotificationSchedule(existingEvents, {
      ...event,
      scheduledAt: "2026-08-28T21:00:00+09:00",
    })
    const atQuietEnd = evaluateNotificationSchedule(existingEvents, {
      ...event,
      scheduledAt: "2026-08-28T08:00:00+09:00",
    })

    // Then
    expect(atQuietStart).toEqual({ allowed: false, reason: "quiet_hours" })
    expect(atQuietEnd).toEqual({ allowed: true })
  })

  it("converts offset variants to the Seoul day and quiet-hour clock", () => {
    // Given
    const existingEvents: (typeof event)[] = []

    // When
    const utcQuiet = evaluateNotificationSchedule(existingEvents, {
      ...event,
      scheduledAt: "2026-08-28T12:30:00Z",
    })
    const wrongLocalDay = evaluateNotificationSchedule(existingEvents, {
      ...event,
      localDay: "2026-08-27",
    })

    // Then
    expect(utcQuiet).toEqual({ allowed: false, reason: "quiet_hours" })
    expect(wrongLocalDay).toEqual({ allowed: false, reason: "invalid_schedule" })
  })

  it("keeps delivery records content-free", () => {
    // Given
    const valid = {
      id: "623e4567-e89b-42d3-a456-426614174000",
      notificationId: event.id,
      channel: "push",
      status: "pending",
      attemptCount: 0,
    }
    const input = { ...valid, body: "Heart rate 180" }

    // When
    const result = NotificationDeliverySchema.safeParse(input)

    // Then
    expect(NotificationDeliverySchema.safeParse(valid).success).toBe(true)
    expect(result.success).toBe(false)
  })

  it("rejects Auth deletion before live Storage and database deletion", () => {
    // Given
    const input = {
      id: "723e4567-e89b-42d3-a456-426614174000",
      status: "processing",
      phase: "auth_identity",
      requestedAt: "2026-08-28T09:00:00+09:00",
      authDeletedAt: "2026-08-28T10:00:00+09:00",
      backupVendorTombstoneDueAt: "2026-09-27T09:00:00+09:00",
      retryCount: 0,
      alertState: "none",
    }

    // When
    const result = AccountDeletionJobSchema.safeParse(input)

    // Then
    expect(result.success).toBe(false)
  })

  it("rejects database deletion after seven days and delayed Auth deletion", () => {
    // Given
    const ordered = {
      id: "823e4567-e89b-42d3-a456-426614174000",
      status: "processing",
      phase: "backup_vendor_tombstone",
      requestedAt: "2026-08-28T09:00:00+09:00",
      storageDeletedAt: "2026-08-28T10:00:00+09:00",
      databaseDeletedAt: "2026-08-28T11:00:00+09:00",
      authDeletedAt: "2026-08-28T11:10:00+09:00",
      backupVendorTombstoneDueAt: "2026-09-27T09:00:00+09:00",
      retryCount: 0,
      alertState: "none",
    } as const

    // When
    const accepted = AccountDeletionJobSchema.safeParse(ordered)
    const lateDatabase = AccountDeletionJobSchema.safeParse({
      ...ordered,
      databaseDeletedAt: "2026-09-04T09:01:00+09:00",
      authDeletedAt: "2026-09-04T09:10:00+09:00",
    })
    const lateAuth = AccountDeletionJobSchema.safeParse({
      ...ordered,
      authDeletedAt: "2026-08-28T11:16:00+09:00",
    })

    // Then
    expect(accepted.success).toBe(true)
    expect(lateDatabase.success).toBe(false)
    expect(lateAuth.success).toBe(false)
  })

  it("rejects a vendor tombstone recorded after its 30-day deadline", () => {
    // Given
    const completed = {
      id: "923e4567-e89b-42d3-a456-426614174000",
      status: "completed",
      phase: "backup_vendor_tombstone",
      requestedAt: "2026-08-28T09:00:00+09:00",
      storageDeletedAt: "2026-08-28T10:00:00+09:00",
      databaseDeletedAt: "2026-08-28T11:00:00+09:00",
      authDeletedAt: "2026-08-28T11:10:00+09:00",
      backupVendorTombstoneDueAt: "2026-09-27T09:00:00+09:00",
      backupVendorTombstoneRecordedAt: "2026-09-27T09:01:00+09:00",
      retryCount: 0,
      alertState: "none",
    } as const

    // When
    const result = AccountDeletionJobSchema.safeParse(completed)

    // Then
    expect(result.success).toBe(false)
  })

  it("enforces screenshot metadata-only expiry windows", () => {
    // Given
    const input = {
      id: "a23e4567-e89b-42d3-a456-426614174000",
      participantProfileId: "223e4567-e89b-42d3-a456-426614174000",
      consentGrantId: "b23e4567-e89b-42d3-a456-426614174000",
      attestationId: "c23e4567-e89b-42d3-a456-426614174000",
      status: "failed",
      createdAt: "2026-08-28T09:00:00+09:00",
      completedAt: "2026-08-28T09:01:00+09:00",
      metadataExpiresAt: "2026-09-05T09:00:00+09:00",
      errorCode: "provider_timeout",
    }

    // When
    const inconsistentStates = [
      {
        ...input,
        status: "processing",
        errorCode: undefined,
        metadataExpiresAt: "2026-08-29T09:00:00+09:00",
      },
      { ...input, errorCode: undefined, metadataExpiresAt: "2026-08-29T09:00:00+09:00" },
      { ...input, status: "succeeded", metadataExpiresAt: "2026-08-29T09:00:00+09:00" },
    ]
    const valid = {
      ...input,
      status: "succeeded",
      errorCode: undefined,
      metadataExpiresAt: "2026-08-29T09:01:00+09:00",
    }

    // When
    const result = ScreenshotDraftJobSchema.safeParse(input)
    const stateResults = inconsistentStates.map((state) =>
      ScreenshotDraftJobSchema.safeParse(state),
    )

    // Then
    expect(ScreenshotDraftJobSchema.safeParse(valid).success).toBe(true)
    expect(result.success).toBe(false)
    expect(stateResults.every((stateResult) => !stateResult.success)).toBe(true)
  })

  it("keeps generative feedback pending named-coach review", () => {
    // Given
    const input = {
      id: "123e4567-e89b-42d3-a456-426614174000",
      participantId: "223e4567-e89b-42d3-a456-426614174000",
      consentGrantId: "323e4567-e89b-42d3-a456-426614174000",
      attestationId: "423e4567-e89b-42d3-a456-426614174000",
      origin: "ai",
      status: "published",
    }

    // When
    const result = FeedbackItemAutomationSchema.safeParse(input)

    // Then
    expect(result.success).toBe(false)
  })
})
