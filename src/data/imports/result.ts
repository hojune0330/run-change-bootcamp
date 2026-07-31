import { type ImportArtifact, type MetricDraft, MetricDraftSchema } from "../../domain"

export const REPRESENTATIVE_WARNING = "representative_adapter_not_vendor_complete" as const

export type ImportIssueCode =
  | "malformed_content"
  | "missing_fields"
  | "invalid_record"
  | "unsupported_record"
  | "unsupported_binary"

export type ImportIssue = {
  readonly code: ImportIssueCode
  readonly message: string
  readonly sourceRecord?: string
}

export type ImportParseResult =
  | {
      readonly kind: "parsed"
      readonly drafts: readonly MetricDraft[]
      readonly warnings: readonly string[]
    }
  | {
      readonly kind: "rejected"
      readonly issues: readonly ImportIssue[]
      readonly warnings: readonly string[]
    }

export type DraftMeasurement =
  | { readonly metric: "distance"; readonly unit: "m"; readonly value: number }
  | { readonly metric: "duration"; readonly unit: "s"; readonly value: number }
  | { readonly metric: "heart_rate"; readonly unit: "bpm"; readonly value: number }
  | { readonly metric: "steps"; readonly unit: "count"; readonly value: number }

export type DraftInput = {
  readonly artifact: ImportArtifact
  readonly ordinal: number
  readonly observedAt: string
  readonly sourceRecord: string
  readonly measurement: DraftMeasurement
  readonly warnings?: readonly string[]
}

export function createDraft(input: DraftInput): MetricDraft | null {
  const warnings = [REPRESENTATIVE_WARNING, ...(input.warnings ?? [])]
  const parsed = MetricDraftSchema.safeParse({
    id: `metric-draft-${input.artifact.checksum.slice(0, 16)}-${input.ordinal}`,
    artifactId: input.artifact.id,
    participantId: input.artifact.participantId,
    observedAt: input.observedAt,
    provenance: {
      adapter: input.artifact.format,
      sourceRecord: input.sourceRecord,
    },
    warnings,
    ...input.measurement,
  })
  return parsed.success ? parsed.data : null
}

export function parsed(
  drafts: readonly MetricDraft[],
  extraWarnings: readonly string[] = [],
): ImportParseResult {
  return {
    kind: "parsed",
    drafts,
    warnings: [REPRESENTATIVE_WARNING, ...extraWarnings],
  }
}

export function rejected(
  issue: ImportIssue,
  extraWarnings: readonly string[] = [],
): ImportParseResult {
  return {
    kind: "rejected",
    issues: [issue],
    warnings: [REPRESENTATIVE_WARNING, ...extraWarnings],
  }
}
