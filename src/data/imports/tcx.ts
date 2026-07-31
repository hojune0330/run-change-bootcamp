import { z } from "zod"
import { type ImportArtifact, IsoDateTimeSchema } from "../../domain"
import { createDraft, type ImportParseResult, parsed, rejected } from "./result"
import { parseXml } from "./xml"

const positiveNumberText = z
  .string()
  .trim()
  .regex(/^(?:\d+\.?\d*|\.\d+)$/)
  .transform(Number)
  .refine((value) => value > 0)

const TcxSummarySchema = z
  .object({
    observedAt: IsoDateTimeSchema,
    distanceMeters: positiveNumberText,
    durationSeconds: positiveNumberText,
  })
  .strict()

export function parseTcx(artifact: ImportArtifact, content: string): ImportParseResult {
  const document = parseXml(content)
  if (document === null) {
    return rejected({ code: "malformed_content", message: "TCX XML is malformed" })
  }
  const summary = TcxSummarySchema.safeParse({
    observedAt: document.querySelector("Id")?.textContent,
    distanceMeters: document.querySelector("DistanceMeters")?.textContent,
    durationSeconds: document.querySelector("TotalTimeSeconds")?.textContent,
  })
  if (!summary.success) {
    return rejected({
      code: "missing_fields",
      message: "TCX needs Id, DistanceMeters, and TotalTimeSeconds",
    })
  }
  const distance = createDraft({
    artifact,
    ordinal: 1,
    observedAt: summary.data.observedAt,
    sourceRecord: "activity-summary-distance",
    measurement: { metric: "distance", unit: "m", value: summary.data.distanceMeters },
  })
  const duration = createDraft({
    artifact,
    ordinal: 2,
    observedAt: summary.data.observedAt,
    sourceRecord: "activity-summary-duration",
    measurement: { metric: "duration", unit: "s", value: summary.data.durationSeconds },
  })
  return distance === null || duration === null
    ? rejected({ code: "invalid_record", message: "TCX values are outside supported bounds" })
    : parsed([distance, duration])
}
