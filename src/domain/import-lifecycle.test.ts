import { describe, expect, it } from "vitest"
import {
  AcceptedStructuredImportDraftSchema,
  AcceptedStructuredImportRecordSchema,
} from "./imports-model"

const acceptedDraft = {
  programId: "program-plus-run-2026",
  participantId: "membership-participant-01",
  format: "fit",
  observedAt: "2026-08-28T07:30:00+09:00",
  sourceFamily: "garmin",
  sourceModel: "forerunner",
  timezone: "Asia/Seoul",
  qualityFlags: ["device_reported"],
  metrics: {
    distanceM: 5_000,
    durationS: 1_800,
    paceSecondsPerKm: 360,
  },
} as const

describe("accepted structured import boundary", () => {
  it("accepts reviewed structured provenance without a browser fingerprint", () => {
    // Given
    const input = acceptedDraft

    // When
    const result = AcceptedStructuredImportDraftSchema.safeParse(input)

    // Then
    expect(result.success).toBe(true)
  })

  it.each([
    ["rawFilename", "run.fit"],
    ["localFingerprint", "a".repeat(64)],
    ["clientHmac", "b".repeat(64)],
    ["routeCoordinates", [[37.5, 126.9]]],
    ["deviceSerial", "serial-123"],
    ["pixels", "base64-image"],
  ])("rejects forbidden persisted key %s", (key, value) => {
    // Given
    const input = { ...acceptedDraft, [key]: value }

    // When
    const result = AcceptedStructuredImportDraftSchema.safeParse(input)

    // Then
    expect(result.success).toBe(false)
  })

  it("accepts only a server-issued duplicate HMAC on the stored record", () => {
    // Given
    const input = {
      ...acceptedDraft,
      id: "import-artifact-accepted-01",
      parserName: "plus_run_fit_adapter",
      parserVersion: "1",
      acceptedBy: "membership-participant-01",
      acceptedAt: "2026-08-28T07:35:00+09:00",
      serverDuplicateHmac: "c".repeat(64),
    }

    // When
    const result = AcceptedStructuredImportRecordSchema.safeParse(input)

    // Then
    expect(result.success).toBe(true)
  })
})
