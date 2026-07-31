import { z } from "zod"
import { type ImportArtifact, IsoDateTimeSchema } from "../../domain"
import {
  createDraft,
  type DraftMeasurement,
  type ImportParseResult,
  parsed,
  rejected,
} from "./result"

const numericText = z
  .string()
  .trim()
  .regex(/^-?(?:\d+\.?\d*|\.\d+)$/)
  .transform(Number)

const CsvRowSchema = z
  .object({
    timestamp: IsoDateTimeSchema,
    metric: z.enum(["distance", "duration", "heart_rate", "steps"]),
    value: numericText,
    unit: z.string().trim().min(1),
  })
  .strict()

class UnexpectedCsvMetricError extends Error {
  readonly name = "UnexpectedCsvMetricError"
}

function assertNever(value: never): never {
  throw new UnexpectedCsvMetricError(`Unexpected CSV metric: ${String(value)}`)
}

function measurementFor(row: z.infer<typeof CsvRowSchema>): DraftMeasurement | null {
  switch (row.metric) {
    case "distance":
      return row.unit === "m" ? { metric: "distance", unit: "m", value: row.value } : null
    case "duration":
      return row.unit === "s" ? { metric: "duration", unit: "s", value: row.value } : null
    case "heart_rate":
      return row.unit === "bpm" ? { metric: "heart_rate", unit: "bpm", value: row.value } : null
    case "steps":
      return row.unit === "count" ? { metric: "steps", unit: "count", value: row.value } : null
    default:
      return assertNever(row.metric)
  }
}

export function parseCsv(artifact: ImportArtifact, content: string): ImportParseResult {
  const lines = content.trim().split(/\r?\n/)
  const header = lines[0]?.split(",").map((cell) => cell.trim()) ?? []
  const timestampIndex = header.indexOf("timestamp")
  const metricIndex = header.indexOf("metric")
  const valueIndex = header.indexOf("value")
  const unitIndex = header.indexOf("unit")
  if ([timestampIndex, metricIndex, valueIndex, unitIndex].some((index) => index < 0)) {
    return rejected({
      code: "missing_fields",
      message: "CSV requires timestamp, metric, value, unit",
    })
  }

  const drafts = []
  for (const [index, line] of lines.slice(1).entries()) {
    const cells = line.split(",").map((cell) => cell.trim())
    const row = CsvRowSchema.safeParse({
      timestamp: cells[timestampIndex],
      metric: cells[metricIndex],
      value: cells[valueIndex],
      unit: cells[unitIndex],
    })
    if (!row.success) {
      return rejected({
        code: "invalid_record",
        message: "CSV row is invalid",
        sourceRecord: `row-${index + 2}`,
      })
    }
    const measurement = measurementFor(row.data)
    if (measurement === null) {
      return rejected({
        code: "invalid_record",
        message: "CSV metric unit is invalid",
        sourceRecord: `row-${index + 2}`,
      })
    }
    const draft = createDraft({
      artifact,
      ordinal: index + 1,
      observedAt: row.data.timestamp,
      sourceRecord: `row-${index + 2}`,
      measurement,
    })
    if (draft === null) {
      return rejected({
        code: "invalid_record",
        message: "CSV metric value is outside supported bounds",
        sourceRecord: `row-${index + 2}`,
      })
    }
    drafts.push(draft)
  }
  return drafts.length > 0
    ? parsed(drafts)
    : rejected({ code: "missing_fields", message: "CSV contains no data rows" })
}
