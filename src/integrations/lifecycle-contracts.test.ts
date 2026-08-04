import { describe, expect, it } from "vitest"
import { parseAcceptedStructuredImportRequest, parseInMemoryScreenshotRequest } from "./contracts"

const acceptedImport = {
  programId: "123e4567-e89b-42d3-a456-426614174000",
  participantId: "223e4567-e89b-42d3-a456-426614174000",
  format: "fit",
  observedAt: "2026-08-28T07:30:00+09:00",
  sourceFamily: "garmin",
  timezone: "Asia/Seoul",
  qualityFlags: ["device_reported"],
  metrics: { distanceM: 5_000, durationS: 1_800 },
} as const

describe("server lifecycle request contracts", () => {
  it("accepts only reviewed structured import fields", () => {
    // Given
    const input = acceptedImport

    // When
    const result = parseAcceptedStructuredImportRequest(input)

    // Then
    expect(result).toEqual({ ok: true, value: input })
  })

  it("canonicalizes duplicate and reordered quality flags", () => {
    // Given
    const input = {
      ...acceptedImport,
      qualityFlags: ["estimated", "device_reported", "estimated"],
    } as const

    // When
    const result = parseAcceptedStructuredImportRequest(input)

    // Then
    expect(result).toEqual({
      ok: true,
      value: { ...input, qualityFlags: ["device_reported", "estimated"] },
    })
  })

  it.each([
    ["rawFilename", "run.fit"],
    ["localFingerprint", "a".repeat(64)],
    ["clientHmac", "b".repeat(64)],
    ["coordinates", [[37.5, 126.9]]],
    ["deviceSerial", "serial-123"],
    ["parserName", "spoofed-client-parser"],
    ["parserVersion", "999.0.0"],
  ])("rejects forbidden import request key %s", (key, value) => {
    // Given
    const input = { ...acceptedImport, [key]: value }

    // When
    const result = parseAcceptedStructuredImportRequest(input)

    // Then
    expect(result).toEqual({ ok: false, error: "invalid_request" })
  })

  it("accepts screenshot metadata for in-memory request processing", () => {
    // Given
    const input = {
      consentGrantId: "323e4567-e89b-42d3-a456-426614174000",
      attestationId: "423e4567-e89b-42d3-a456-426614174000",
      idempotencyKey: "screen-2026-08-28-001",
      mimeType: "image/jpeg",
      byteLength: 24_000,
    }

    // When
    const result = parseInMemoryScreenshotRequest(input)

    // Then
    expect(result).toEqual({ ok: true, value: input })
  })

  it.each([
    ["uploadId", "523e4567-e89b-42d3-a456-426614174000"],
    ["objectPath", "screenshots/raw.jpg"],
    ["pixels", "base64-image"],
    ["clientHmac", "c".repeat(64)],
    ["coordinates", [[37.5, 126.9]]],
    ["deviceSerial", "serial-123"],
  ])("rejects durable or sensitive screenshot request key %s", (key, value) => {
    // Given
    const input = {
      consentGrantId: "323e4567-e89b-42d3-a456-426614174000",
      attestationId: "423e4567-e89b-42d3-a456-426614174000",
      idempotencyKey: "screen-2026-08-28-001",
      mimeType: "image/jpeg",
      byteLength: 24_000,
      [key]: value,
    }

    // When
    const result = parseInMemoryScreenshotRequest(input)

    // Then
    expect(result).toEqual({ ok: false, error: "invalid_request" })
  })
})
