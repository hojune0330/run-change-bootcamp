import { parseImportArtifact } from "../data/imports/index.ts"
import { ImportArtifactSchema, type ImportFormat } from "../domain/index.ts"
import type { DraftResult, ReviewDraftViewModel } from "../features/participant/index.ts"
import type { DemoDraft, DemoParticipantId } from "./state.ts"

export type DraftCreation =
  | { readonly kind: "success"; readonly draft: DemoDraft; readonly view: ReviewDraftViewModel }
  | { readonly kind: "error"; readonly result: DraftResult }

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

function viewFor(draft: DemoDraft): ReviewDraftViewModel {
  return {
    id: draft.id,
    source: draft.source,
    sourceLabel: draft.sourceLabel,
    metrics: draft.metrics,
    notes: draft.notes,
  }
}

export async function createFileDraft(
  participantId: DemoParticipantId,
  file: File,
): Promise<DraftCreation> {
  const format = importFormat(file.name)
  if (format === null) {
    return { kind: "error", result: { kind: "error", message: "지원하지 않는 파일이에요." } }
  }
  const content = await file.text()
  const digest = checksum(content)
  const artifact = ImportArtifactSchema.parse({
    id: `import-artifact-${digest}`,
    participantId: `membership-${participantId}`,
    format,
    originalFilename: file.name,
    checksum: digest,
    byteSize: file.size,
    importedAt: "2026-08-31T09:00:00+09:00",
  })
  const parsed = parseImportArtifact(artifact, content)
  if (parsed.kind === "rejected") {
    return { kind: "error", result: { kind: "error", message: "파일 내용을 확인해 주세요." } }
  }
  const metrics = parsed.drafts.map((item) => metricPresentation(item.metric, item.value))
  const draft: DemoDraft = {
    id: `draft-file-${digest}`,
    participantId,
    source: "file",
    sourceLabel: file.name,
    metrics,
    notes: ["가져온 값은 검토 후에도 초안으로 보관됩니다."],
    status: "pending",
  }
  return { kind: "success", draft, view: viewFor(draft) }
}

export async function createScreenshotDraft(
  participantId: DemoParticipantId,
  file: File,
): Promise<DraftCreation> {
  const content = await file.text()
  const digest = checksum(`${file.name}:${content}`)
  const draft: DemoDraft = {
    id: `draft-screenshot-${digest}`,
    participantId,
    source: "screenshot",
    sourceLabel: file.name,
    metrics: [],
    notes: [
      "분석 대기 · 추출 연결이 필요합니다.",
      "운영 추출이 연결되기 전에는 수치를 생성하지 않습니다.",
    ],
    status: "pending",
  }
  return { kind: "success", draft, view: viewFor(draft) }
}
