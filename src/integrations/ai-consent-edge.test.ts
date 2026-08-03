import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it, vi } from "vitest"
import {
  type AiConsentPurpose,
  type AiConsentReader,
  parseOpenAiProjectId,
  runAfterActiveAiConsent,
} from "../../supabase/functions/_shared/ai-consent"
import { parseFeedbackDraftRequest, parseScreenshotDraftRequest } from "./contracts"

const PROGRAM_ID = "11111111-1111-4111-8111-111111111111"
const PARTICIPANT_ID = "22222222-2222-4222-8222-222222222222"
const PROJECT_ID = "proj-plus-run-zdr"
const NOW = new Date("2026-08-29T12:00:00Z")
const HOSTILE_KINDS = [
  "absent",
  "revoked",
  "expired",
  "not-yet",
  "wrong-purpose",
  "wrong-project",
  "wrong-provider",
  "wrong-class-order",
  "wrong-endpoint",
  "wrong-disclosure",
  "wrong-zdr",
] as const

type HostileKind = (typeof HOSTILE_KINDS)[number]

function dataClasses(purpose: AiConsentPurpose): readonly string[] {
  return purpose === "screenshot_ai"
    ? ["server_sanitized_screenshot_pixels", "reviewable_metric_draft"]
    : ["approved_nonsensitive_training_context", "feedback_draft"]
}

function activeGrant(purpose: AiConsentPurpose) {
  return {
    program_id: PROGRAM_ID,
    participant_profile_id: PARTICIPANT_ID,
    purpose,
    provider: "openai",
    provider_project_id: PROJECT_ID,
    endpoint: "/v1/responses",
    data_classes: dataClasses(purpose),
    processor_disclosure: "openai_subprocessor_disclosed",
    zero_data_retention_control: "approved_project_endpoint_zdr",
    status: "active",
    granted_at: "2026-08-29T10:00:00Z",
    expires_at: "2026-09-29T10:00:00Z",
    withdrawn_at: null,
  }
}

function hostileGrant(kind: HostileKind, purpose: AiConsentPurpose): unknown {
  const grant = activeGrant(purpose)
  switch (kind) {
    case "absent":
      return null
    case "revoked":
      return { ...grant, status: "withdrawn", withdrawn_at: "2026-08-29T11:00:00Z" }
    case "expired":
      return { ...grant, expires_at: "2026-08-29T12:00:00Z" }
    case "not-yet":
      return { ...grant, granted_at: "2026-08-29T12:00:01Z" }
    case "wrong-purpose":
      return {
        ...grant,
        purpose: purpose === "screenshot_ai" ? "generative_feedback_ai" : "screenshot_ai",
      }
    case "wrong-project":
      return { ...grant, provider_project_id: "proj-other" }
    case "wrong-provider":
      return { ...grant, provider: "other" }
    case "wrong-class-order":
      return { ...grant, data_classes: [...grant.data_classes].reverse() }
    case "wrong-endpoint":
      return { ...grant, endpoint: "/responses" }
    case "wrong-disclosure":
      return { ...grant, processor_disclosure: "other_disclosure" }
    case "wrong-zdr":
      return { ...grant, zero_data_retention_control: null }
  }
}

const purposes = ["screenshot_ai", "generative_feedback_ai"] as const

describe.each(purposes)("%s Edge consent boundary", (purpose) => {
  it.each(HOSTILE_KINDS)("rejects %s before job creation or provider invocation", async (kind) => {
    const reader: AiConsentReader = async () => hostileGrant(kind, purpose)
    const provider = vi.fn(async () => "provider-result")
    const createJob = vi.fn(async () => provider())

    await expect(
      runAfterActiveAiConsent(
        reader,
        { programId: PROGRAM_ID, participantId: PARTICIPANT_ID, purpose, projectId: PROJECT_ID },
        createJob,
        NOW,
      ),
    ).rejects.toMatchObject({ code: "ai_consent_required", status: 403 })
    expect(createJob).not.toHaveBeenCalled()
    expect(provider).not.toHaveBeenCalled()
  })

  it("runs both the job and provider only after two exact active checks", async () => {
    const reader = vi.fn<AiConsentReader>(async () => activeGrant(purpose))
    const provider = vi.fn(async () => "provider-result")
    const spec = {
      programId: PROGRAM_ID,
      participantId: PARTICIPANT_ID,
      purpose,
      projectId: PROJECT_ID,
    } as const
    const createJob = vi.fn(async () => runAfterActiveAiConsent(reader, spec, provider, NOW))

    await expect(runAfterActiveAiConsent(reader, spec, createJob, NOW)).resolves.toBe(
      "provider-result",
    )
    expect(reader).toHaveBeenCalledTimes(2)
    expect(createJob).toHaveBeenCalledTimes(1)
    expect(provider).toHaveBeenCalledTimes(1)
  })

  it("blocks the provider when consent is withdrawn after the job claim", async () => {
    const reader = vi
      .fn<AiConsentReader>()
      .mockResolvedValueOnce(activeGrant(purpose))
      .mockResolvedValueOnce(hostileGrant("revoked", purpose))
    const provider = vi.fn(async () => "provider-result")
    const spec = {
      programId: PROGRAM_ID,
      participantId: PARTICIPANT_ID,
      purpose,
      projectId: PROJECT_ID,
    } as const
    const createJob = vi.fn(async () => runAfterActiveAiConsent(reader, spec, provider, NOW))

    await expect(runAfterActiveAiConsent(reader, spec, createJob, NOW)).rejects.toMatchObject({
      code: "ai_consent_required",
      status: 403,
    })
    expect(createJob).toHaveBeenCalledTimes(1)
    expect(provider).not.toHaveBeenCalled()
  })
})

describe("AI Edge handler wiring", () => {
  const repository = process.cwd()
  const screenshot = readFileSync(
    resolve(repository, "supabase/functions/screenshot-to-metric-draft/index.ts"),
    "utf8",
  )
  const feedback = readFileSync(
    resolve(repository, "supabase/functions/draft-feedback/index.ts"),
    "utf8",
  )
  const openai = readFileSync(resolve(repository, "supabase/functions/_shared/openai.ts"), "utf8")

  it.each([
    [
      "screenshot",
      screenshot,
      "participantId: upload.data.owner_profile_id",
      'purpose: "screenshot_ai"',
    ],
    [
      "feedback",
      feedback,
      "participantId: submission.data.participant_id",
      'purpose: "generative_feedback_ai"',
    ],
  ])(
    "gates the %s job claim and provider call with the server project",
    (_, source, owner, purpose) => {
      const firstGate = source.indexOf("assertActiveAiConsent(context.serviceClient")
      const claim = source.indexOf("claimAiRequest(context.serviceClient")
      const finalGate = source.lastIndexOf("withActiveAiConsent(context.serviceClient")
      const provider = source.indexOf("requestStructuredOutput(")

      expect(firstGate).toBeGreaterThanOrEqual(0)
      expect(firstGate).toBeLessThan(claim)
      expect(finalGate).toBeGreaterThan(claim)
      expect(finalGate).toBeLessThan(provider)
      expect(source).toContain(owner)
      expect(source).toContain(purpose)
      expect(source).toContain("projectId: config.projectId")
    },
  )

  it("binds the outgoing Responses request to the required server project", () => {
    expect(openai).toContain('parseOpenAiProjectId(Deno.env.get("OPENAI_PROJECT_ID"))')
    expect(openai).toContain('"OpenAI-Project": config.projectId')
    expect(parseOpenAiProjectId(undefined)).toBeNull()
    expect(parseOpenAiProjectId("client supplied project")).toBeNull()
    expect(parseOpenAiProjectId(`  ${PROJECT_ID}  `)).toBe(PROJECT_ID)
  })

  it("rejects caller-supplied project or consent identifiers", () => {
    expect(
      parseScreenshotDraftRequest({
        uploadId: "33333333-3333-4333-8333-333333333333",
        idempotencyKey: "request-123",
        deidentified: true,
        projectId: PROJECT_ID,
      }),
    ).toEqual({ ok: false, error: "invalid_request" })
    expect(
      parseFeedbackDraftRequest({
        submissionId: "44444444-4444-4444-8444-444444444444",
        idempotencyKey: "request-456",
        consentGrantId: "55555555-5555-4555-8555-555555555555",
      }),
    ).toEqual({ ok: false, error: "invalid_request" })
  })
})
