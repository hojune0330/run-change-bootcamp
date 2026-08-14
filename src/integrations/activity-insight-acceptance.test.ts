import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { parseActivityInsightAcceptanceRequest } from "./activity-insight-acceptance"

const PROGRAM_ID = "123e4567-e89b-42d3-a456-426614174000"
const PARTICIPANT_ID = "223e4567-e89b-42d3-a456-426614174000"
const CONSENT_ID = "323e4567-e89b-42d3-a456-426614174000"

const validEnvelope = {
  consentGrantId: CONSENT_ID,
  acceptedImport: {
    programId: PROGRAM_ID,
    participantId: PARTICIPANT_ID,
    format: "csv",
    observedAt: "2026-08-25T07:30:00+09:00",
    sourceFamily: "reviewed_csv",
    timezone: "Asia/Seoul",
    qualityFlags: ["estimated", "device_reported", "estimated"],
    metrics: { distanceM: 5_000, durationS: 1_800 },
  },
  rebuild: {
    programId: PROGRAM_ID,
    participantId: PARTICIPANT_ID,
    acceptedImportIds: [],
    weekStart: "2026-08-24",
    idempotencyKey: "activity-insight-2026-08-24-001",
  },
} as const

describe("activity insight service acceptance", () => {
  it("parses the reviewed import and exact Task 4 rebuild payload", () => {
    // Given
    const input = validEnvelope

    // When
    const result = parseActivityInsightAcceptanceRequest(input)

    // Then
    expect(result).toEqual({
      ok: true,
      value: {
        ...input,
        acceptedImport: {
          ...input.acceptedImport,
          qualityFlags: ["device_reported", "estimated"],
        },
      },
    })
  })

  it.each([
    ["unexpected Task 4 key", { rebuild: { ...validEnvelope.rebuild, rawBytes: "AAE=" } }],
    [
      "cross-program import",
      { acceptedImport: { ...validEnvelope.acceptedImport, programId: CONSENT_ID } },
    ],
    [
      "cross-participant import",
      { acceptedImport: { ...validEnvelope.acceptedImport, participantId: CONSENT_ID } },
    ],
    [
      "out-of-week import",
      {
        acceptedImport: {
          ...validEnvelope.acceptedImport,
          observedAt: "2026-08-31T00:00:00+09:00",
        },
      },
    ],
    [
      "disabled binary import",
      { acceptedImport: { ...validEnvelope.acceptedImport, format: "fit" } },
    ],
    ["outer extra key", { browserCredential: "forbidden" }],
  ])("rejects %s", (_name, override) => {
    // Given
    const input = { ...validEnvelope, ...override }

    // When
    const result = parseActivityInsightAcceptanceRequest(input)

    // Then
    expect(result).toEqual({ ok: false, error: "invalid_request" })
  })

  it("keeps the Edge entry behind JWT verification and the service credential", () => {
    // Given
    const repository = process.cwd()

    // When
    const config = readFileSync(resolve(repository, "supabase/config.toml"), "utf8")
    const edgeEntry = readFileSync(
      resolve(repository, "supabase/functions/accept-activity-import/index.ts"),
      "utf8",
    )

    // Then
    expect(config).toMatch(/\[functions\.accept-activity-import\]\s+verify_jwt\s*=\s*true/)
    expect(edgeEntry).toContain("SUPABASE_SERVICE_ROLE_KEY")
    expect(edgeEntry).toMatch(/authorization !== `Bearer \$\{serviceKey\}`/)
    expect(edgeEntry).not.toContain("authenticate(request)")
  })
})
