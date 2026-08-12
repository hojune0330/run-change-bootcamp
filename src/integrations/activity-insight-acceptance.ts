import { z } from "zod"
import {
  type ActivityInsightRebuildRequest,
  parseActivityInsightRebuildRequest,
} from "./activity-insight-contracts"
import {
  type AcceptedStructuredImportRequest,
  type ParseResult,
  parseAcceptedStructuredImportRequest,
} from "./contracts"

const DAY_MS = 24 * 60 * 60 * 1_000

const ActivityInsightAcceptanceEnvelopeSchema = z
  .object({
    consentGrantId: z.uuid(),
    acceptedImport: z.unknown(),
    rebuild: z.unknown(),
  })
  .strict()
  .readonly()

export type ActivityInsightAcceptanceRequest = {
  readonly consentGrantId: string
  readonly acceptedImport: AcceptedStructuredImportRequest
  readonly rebuild: ActivityInsightRebuildRequest
}

export function parseActivityInsightAcceptanceRequest(
  input: unknown,
): ParseResult<ActivityInsightAcceptanceRequest> {
  const envelope = ActivityInsightAcceptanceEnvelopeSchema.safeParse(input)
  if (!envelope.success) return { ok: false, error: "invalid_request" }

  const acceptedImport = parseAcceptedStructuredImportRequest(envelope.data.acceptedImport)
  const rebuild = parseActivityInsightRebuildRequest(envelope.data.rebuild)
  if (!acceptedImport.ok || !rebuild.ok) return { ok: false, error: "invalid_request" }

  const weekStart = Date.parse(`${rebuild.value.weekStart}T00:00:00+09:00`)
  const observedAt = Date.parse(acceptedImport.value.observedAt)
  if (
    acceptedImport.value.programId !== rebuild.value.programId ||
    acceptedImport.value.participantId !== rebuild.value.participantId ||
    acceptedImport.value.format === "fit" ||
    observedAt < weekStart ||
    observedAt >= weekStart + 7 * DAY_MS
  ) {
    return { ok: false, error: "invalid_request" }
  }

  return {
    ok: true,
    value: {
      consentGrantId: envelope.data.consentGrantId,
      acceptedImport: acceptedImport.value,
      rebuild: rebuild.value,
    },
  }
}
