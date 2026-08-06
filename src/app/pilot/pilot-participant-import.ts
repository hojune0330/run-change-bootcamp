import { parseImportArtifact } from "../../data/imports/index.ts"
import { ImportArtifactSchema, type ImportFormat } from "../../domain/index.ts"
import type { ReviewDraftViewModel } from "../../features/participant/models.ts"
import type {
  PilotGateway,
  PilotOperationError,
} from "../../integrations/supabase/pilot-gateway.ts"

export const MAX_IMPORT_BYTES = 15_728_640

export type ActivityImportOutcome =
  | { readonly kind: "success"; readonly draft: ReviewDraftViewModel; readonly uploadId: string }
  | { readonly kind: "local_error"; readonly message: string }
  | { readonly kind: "gateway_error"; readonly error: PilotOperationError }

function checksum(content: string): string {
  let value = 2_166_136_261
  for (const character of content) {
    value = Math.imul(value ^ character.charCodeAt(0), 16_777_619)
  }
  const first = (value >>> 0).toString(16).padStart(8, "0")
  const second = content.length.toString(16).padStart(8, "0")
  return `${first}${second}`
}

function importFormat(filename: string): ImportFormat | null {
  const extension = filename.toLowerCase().split(".").at(-1)
  switch (extension) {
    case "csv":
      return "csv"
    case "fit":
      return "fit"
    case "gpx":
      return "gpx"
    case "tcx":
      return "tcx"
    case "xml":
      return "apple-xml"
    case "json":
      return "samsung-json"
    default:
      return null
  }
}

function uploadKindFor(format: ImportFormat): "csv" | "fit" | "gpx" | "json" | "tcx" | "xml" {
  switch (format) {
    case "csv":
      return "csv"
    case "fit":
      return "fit"
    case "gpx":
      return "gpx"
    case "tcx":
      return "tcx"
    case "apple-xml":
      return "xml"
    case "samsung-json":
      return "json"
  }
}

type SupportedDraftRecord = {
  readonly metricType: "distance_m" | "duration_s" | "heart_rate_bpm"
  readonly numericValue: number
  readonly observedAt: string
  readonly unit: "bpm" | "m" | "s"
}

function draftRecordFor(draft: {
  readonly metric: "distance" | "duration" | "heart_rate" | "steps"
  readonly observedAt: string
  readonly value: number
}): SupportedDraftRecord | null {
  switch (draft.metric) {
    case "distance":
      return {
        metricType: "distance_m",
        numericValue: draft.value,
        observedAt: draft.observedAt,
        unit: "m",
      }
    case "duration":
      return {
        metricType: "duration_s",
        numericValue: draft.value,
        observedAt: draft.observedAt,
        unit: "s",
      }
    case "heart_rate":
      return {
        metricType: "heart_rate_bpm",
        numericValue: draft.value,
        observedAt: draft.observedAt,
        unit: "bpm",
      }
    case "steps":
      return null
  }
}

function metricPresentation(
  metric: "distance" | "duration" | "heart_rate" | "steps",
  value: number,
) {
  switch (metric) {
    case "distance":
      return { label: "거리", value: `${(value / 1_000).toFixed(1)} km` }
    case "duration":
      return { label: "운동 시간", value: `${Math.round(value / 60)}분` }
    case "heart_rate":
      return { label: "심박수", value: `${Math.round(value)} bpm` }
    case "steps":
      return { label: "걸음 수", value: `${Math.round(value)}보` }
  }
}

export async function importActivityFile(
  gateway: PilotGateway,
  programId: string,
  file: File,
): Promise<ActivityImportOutcome> {
  const format = importFormat(file.name)
  if (format === null) {
    return { kind: "local_error", message: "지원하지 않는 파일이에요." }
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return { kind: "local_error", message: "파일이 너무 커요. 15MB 이하 파일을 선택해 주세요." }
  }
  const content = await file.text()
  const digest = checksum(content)
  const artifact = ImportArtifactSchema.parse({
    id: `import-artifact-${digest}`,
    participantId: `membership-${programId}`,
    format,
    originalFilename: file.name,
    checksum: digest,
    byteSize: file.size,
    importedAt: "2026-08-31T09:00:00+09:00",
  })
  const parsed = parseImportArtifact(artifact, content)
  if (parsed.kind === "rejected") {
    return { kind: "local_error", message: "파일 내용을 확인해 주세요." }
  }
  const skippedSteps = parsed.drafts.filter((draft) => draft.metric === "steps").length
  const draftRecords = parsed.drafts.flatMap((draft) => {
    const record = draftRecordFor(draft)
    return record === null ? [] : [record]
  })
  if (draftRecords.length === 0) {
    return { kind: "local_error", message: "가져온 값이 파일럿 기록 범위에 없어요." }
  }
  const result = await gateway.importActivityDraft({
    draftRecords,
    fileName: file.name,
    fileSize: file.size,
    programId,
    uploadKind: uploadKindFor(format),
  })
  if (!result.ok) {
    return { kind: "gateway_error", error: result.error }
  }
  const notes = ["가져온 값은 검토 후에도 초안으로 보관됩니다."]
  if (skippedSteps > 0) {
    notes.push("걸음 수는 파일럿 가져오기 범위에 아직 없어요.")
  }
  const draft: ReviewDraftViewModel = {
    id: `draft-${digest}`,
    source: "file",
    sourceLabel: file.name,
    metrics: parsed.drafts.flatMap((item) => {
      if (item.metric === "steps") {
        return []
      }
      const presentation = metricPresentation(item.metric, item.value)
      return [{ label: presentation.label, value: presentation.value }]
    }),
    notes,
  }
  return { kind: "success", draft, uploadId: result.value.uploadId }
}
