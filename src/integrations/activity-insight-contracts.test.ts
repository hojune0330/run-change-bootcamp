import { describe, expect, it } from "vitest"
import {
  parseActivityInsightRebuildRequest,
  parseActivityInsightRebuildResponse,
} from "./activity-insight-contracts"

const PROGRAM_ID = "123e4567-e89b-42d3-a456-426614174000"
const PARTICIPANT_ID = "223e4567-e89b-42d3-a456-426614174000"
const IMPORT_ID = "323e4567-e89b-42d3-a456-426614174000"

const validRequest = {
  programId: PROGRAM_ID,
  participantId: PARTICIPANT_ID,
  acceptedImportIds: [IMPORT_ID],
  weekStart: "2026-08-24",
  idempotencyKey: "activity-insight-2026-08-24-001",
} as const

describe("activity insight rebuild contracts", () => {
  it("accepts a service rebuild request containing only accepted import references", () => {
    // Given
    const input = validRequest

    // When
    const result = parseActivityInsightRebuildRequest(input)

    // Then
    expect(result).toEqual({ ok: true, value: input })
  })

  it("rejects duplicate IDs or forged per-import ownership fields", () => {
    // Given
    const duplicateIds = { ...validRequest, acceptedImportIds: [IMPORT_ID, IMPORT_ID] }
    const forgedOwnershipField = {
      ...validRequest,
      participantProfileId: "423e4567-e89b-42d3-a456-426614174000",
    }

    // When
    const duplicateResult = parseActivityInsightRebuildRequest(duplicateIds)
    const forgedOwnershipResult = parseActivityInsightRebuildRequest(forgedOwnershipField)

    // Then
    expect(duplicateResult).toEqual({ ok: false, error: "invalid_request" })
    expect(forgedOwnershipResult).toEqual({ ok: false, error: "invalid_request" })
  })

  it.each([
    ["programId", "not-a-uuid"],
    ["participantId", "223e4567-e89b-42d3-a456-42661417400"],
    ["acceptedImportIds", ["not-a-uuid"]],
    ["weekStart", "2026-08-23"],
    ["weekStart", "2026-02-30"],
    ["idempotencyKey", "unsafe key"],
  ])("rejects malformed rebuild field %s", (key, value) => {
    // Given
    const input = { ...validRequest, [key]: value }

    // When
    const result = parseActivityInsightRebuildRequest(input)

    // Then
    expect(result).toEqual({ ok: false, error: "invalid_request" })
  })

  it.each([
    ["rawBytes", new Uint8Array([1, 2, 3])],
    ["base64", "AAECAw=="],
    ["file", "run.fit"],
    ["filename", "run.fit"],
    ["providerToken", "provider-secret"],
    ["provider", "garmin"],
    ["gpsPoints", [[37.5, 126.9]]],
    ["browserFingerprint", "fingerprint"],
    ["pendingDraftId", IMPORT_ID],
    ["parserName", "client-parser"],
    ["parserVersion", "9.9.9"],
  ])("rejects forbidden rebuild key %s", (key, value) => {
    // Given
    const input = { ...validRequest, [key]: value }

    // When
    const result = parseActivityInsightRebuildRequest(input)

    // Then
    expect(result).toEqual({ ok: false, error: "invalid_request" })
  })

  it("accepts only safe rebuild header metadata in the response", () => {
    // Given
    const input = {
      status: "rebuilt",
      insightId: "423e4567-e89b-42d3-a456-426614174000",
      programId: PROGRAM_ID,
      participantId: PARTICIPANT_ID,
      weekStart: "2026-08-24",
      weekEnd: "2026-08-31",
      sourceCount: 1,
      templateVersion: "activity-insight.v1",
    } as const

    // When
    const result = parseActivityInsightRebuildResponse(input)

    // Then
    expect(result).toEqual({ ok: true, value: input })
  })

  it.each(["metrics", "sourceFamily", "provider", "credential", "rawPayload"])(
    "rejects unsafe response key %s",
    (key) => {
      // Given
      const input = {
        status: "rebuilt",
        insightId: "423e4567-e89b-42d3-a456-426614174000",
        programId: PROGRAM_ID,
        participantId: PARTICIPANT_ID,
        weekStart: "2026-08-24",
        weekEnd: "2026-08-31",
        sourceCount: 1,
        templateVersion: "activity-insight.v1",
        [key]: {},
      }

      // When
      const result = parseActivityInsightRebuildResponse(input)

      // Then
      expect(result).toEqual({ ok: false, error: "invalid_request" })
    },
  )
})
