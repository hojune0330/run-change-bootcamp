import { describe, expect, it } from "vitest"
import {
  parseFeedbackApprovalRequest,
  parseFeedbackDraftRequest,
  parseScreenshotDraftRequest,
} from "./contracts"

const ID = "123e4567-e89b-42d3-a456-426614174000"

describe("Edge Function request contracts", () => {
  it("rejects a forged participant identifier on screenshot extraction", () => {
    // Given
    const input = {
      uploadId: ID,
      idempotencyKey: "screen-2026-08-24-001",
      deidentified: true,
      userId: "223e4567-e89b-42d3-a456-426614174000",
    }

    // When
    const result = parseScreenshotDraftRequest(input)

    // Then
    expect(result).toEqual({ ok: false, error: "invalid_request" })
  })

  it("accepts a strict screenshot draft request without caller identity", () => {
    // Given
    const input = {
      uploadId: ID,
      idempotencyKey: "screen-2026-08-24-001",
      deidentified: true,
    }

    // When
    const result = parseScreenshotDraftRequest(input)

    // Then
    expect(result).toEqual({ ok: true, value: input })
  })

  it("rejects feedback drafting with an invalid idempotency key", () => {
    // Given
    const input = { submissionId: ID, idempotencyKey: "spaces are unsafe" }

    // When
    const result = parseFeedbackDraftRequest(input)

    // Then
    expect(result).toEqual({ ok: false, error: "invalid_request" })
  })

  it("rejects approval decisions outside the explicit review states", () => {
    // Given
    const input = { feedbackId: ID, decision: "published" }

    // When
    const result = parseFeedbackApprovalRequest(input)

    // Then
    expect(result).toEqual({ ok: false, error: "invalid_request" })
  })
})
