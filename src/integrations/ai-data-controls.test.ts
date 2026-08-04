import { describe, expect, it } from "vitest"
import { AiControlAttestationSchema, authorizeAiControl } from "./ai-safety"

const attestation = {
  provider: "openai",
  organizationId: "org_plus_run",
  projectId: "proj_plus_run_zdr",
  endpoint: "/v1/responses",
  control: "approved_project_endpoint_zdr",
  purposes: ["screenshot_ai"],
  dataClasses: ["server_sanitized_screenshot_pixels", "reviewable_metric_draft"],
  approvedAt: "2026-08-01T00:00:00Z",
  expiresAt: "2026-12-31T23:59:59Z",
  revokedAt: null,
} as const

const requirement = {
  organizationId: "org_plus_run",
  projectId: "proj_plus_run_zdr",
  endpoint: "/v1/responses",
  purpose: "screenshot_ai",
  dataClasses: ["server_sanitized_screenshot_pixels", "reviewable_metric_draft"],
  now: "2026-08-28T09:00:00+09:00",
} as const

describe("OpenAI data-control boundary", () => {
  it("authorizes an exact approved project, endpoint, purpose, and data class", () => {
    // Given
    const parsed = AiControlAttestationSchema.parse(attestation)

    // When
    const result = authorizeAiControl(parsed, requirement)

    // Then
    expect(result).toEqual({ ok: true, value: parsed })
  })

  it.each([
    ["projectId", "proj_wrong"],
    ["organizationId", "org_wrong"],
    ["endpoint", "/v1/chat/completions"],
    ["purpose", "generative_feedback_ai"],
    ["dataClasses", ["approved_nonsensitive_training_context", "feedback_draft"]],
  ])("fails closed for a mismatched %s", (key, value) => {
    // Given
    const parsed = AiControlAttestationSchema.parse(attestation)
    const mismatched = { ...requirement, [key]: value }

    // When
    const result = authorizeAiControl(parsed, mismatched)

    // Then
    expect(result).toEqual({ ok: false, error: "zdr_attestation_required" })
  })

  it("rejects expired or revoked control evidence", () => {
    // Given
    const expired = AiControlAttestationSchema.parse({
      ...attestation,
      expiresAt: "2026-08-27T00:00:00Z",
    })
    const revoked = AiControlAttestationSchema.parse({
      ...attestation,
      revokedAt: "2026-08-27T00:00:00Z",
    })

    // When
    const expiredResult = authorizeAiControl(expired, requirement)
    const revokedResult = authorizeAiControl(revoked, requirement)

    // Then
    expect(expiredResult.ok).toBe(false)
    expect(revokedResult.ok).toBe(false)
  })

  it("does not parse an application-state flag as a control attestation", () => {
    // Given
    const input = { store: false }

    // When
    const result = AiControlAttestationSchema.safeParse(input)

    // Then
    expect(result.success).toBe(false)
  })

  it("rejects attestation data classes that do not exactly match its purposes", () => {
    // Given
    const mismatched = {
      ...attestation,
      purposes: ["screenshot_ai"],
      dataClasses: [
        "server_sanitized_screenshot_pixels",
        "reviewable_metric_draft",
        "feedback_draft",
      ],
    }

    // When
    const result = AiControlAttestationSchema.safeParse(mismatched)

    // Then
    expect(result.success).toBe(false)
  })

  it("rejects duplicate classes that omit a required class", () => {
    // Given
    const duplicateAttestation = {
      ...attestation,
      dataClasses: ["server_sanitized_screenshot_pixels", "server_sanitized_screenshot_pixels"],
    }
    const parsed = AiControlAttestationSchema.parse(attestation)
    const duplicateRequirement = {
      ...requirement,
      dataClasses: [
        "server_sanitized_screenshot_pixels",
        "server_sanitized_screenshot_pixels",
      ] as const,
    }

    // When
    const attestationResult = AiControlAttestationSchema.safeParse(duplicateAttestation)
    const authorizationResult = authorizeAiControl(parsed, duplicateRequirement)

    // Then
    expect(attestationResult.success).toBe(false)
    expect(authorizationResult).toEqual({ ok: false, error: "zdr_attestation_required" })
  })
})
