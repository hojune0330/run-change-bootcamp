import { z } from "zod"
import { type ImportArtifact, IsoDateTimeSchema } from "../../domain"
import { createDraft, type ImportParseResult, parsed, rejected } from "./result"
import { parseXml } from "./xml"

const HeartRateRecordSchema = z
  .object({
    type: z.literal("HKQuantityTypeIdentifierHeartRate"),
    unit: z.literal("count/min"),
    value: z
      .string()
      .trim()
      .regex(/^(?:\d+\.?\d*|\.\d+)$/)
      .transform(Number),
    observedAt: IsoDateTimeSchema,
  })
  .strict()

export function parseAppleXml(artifact: ImportArtifact, content: string): ImportParseResult {
  const document = parseXml(content)
  if (document === null) {
    return rejected({ code: "malformed_content", message: "Apple Health XML is malformed" })
  }
  const element = Array.from(document.querySelectorAll("Record")).find(
    (record) => record.getAttribute("type") === "HKQuantityTypeIdentifierHeartRate",
  )
  if (element === undefined) {
    return rejected({
      code: "unsupported_record",
      message: "No representative heart-rate record found",
    })
  }
  const record = HeartRateRecordSchema.safeParse({
    type: element.getAttribute("type"),
    unit: element.getAttribute("unit"),
    value: element.getAttribute("value"),
    observedAt: element.getAttribute("startDate"),
  })
  if (!record.success) {
    return rejected({ code: "invalid_record", message: "Apple heart-rate record is invalid" })
  }
  const draft = createDraft({
    artifact,
    ordinal: 1,
    observedAt: record.data.observedAt,
    sourceRecord: "heart-rate-record-1",
    measurement: { metric: "heart_rate", unit: "bpm", value: record.data.value },
  })
  return draft === null
    ? rejected({ code: "invalid_record", message: "Apple heart rate is outside supported bounds" })
    : parsed([draft])
}
