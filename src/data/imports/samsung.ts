import { z } from "zod"
import { type ImportArtifact, IsoDateTimeSchema } from "../../domain"
import { createDraft, type ImportParseResult, parsed, rejected } from "./result"

const SamsungExportSchema = z
  .object({
    records: z
      .array(
        z
          .object({
            type: z.literal("step_count"),
            value: z.number().int().nonnegative(),
            unit: z.literal("count"),
            startTime: IsoDateTimeSchema,
          })
          .strict(),
      )
      .min(1),
  })
  .strict()

export function parseSamsungJson(artifact: ImportArtifact, content: string): ImportParseResult {
  let input: unknown
  try {
    input = JSON.parse(content)
  } catch (error) {
    if (error instanceof SyntaxError) {
      return rejected({ code: "malformed_content", message: "Samsung JSON is malformed" })
    }
    throw error
  }
  const data = SamsungExportSchema.safeParse(input)
  if (!data.success) {
    return rejected({ code: "invalid_record", message: "Samsung step record is invalid" })
  }
  const drafts = data.data.records.flatMap((record, index) => {
    const draft = createDraft({
      artifact,
      ordinal: index + 1,
      observedAt: record.startTime,
      sourceRecord: `step-record-${index + 1}`,
      measurement: { metric: "steps", unit: "count", value: record.value },
    })
    return draft === null ? [] : [draft]
  })
  return drafts.length === data.data.records.length
    ? parsed(drafts)
    : rejected({ code: "invalid_record", message: "Samsung steps are outside supported bounds" })
}
