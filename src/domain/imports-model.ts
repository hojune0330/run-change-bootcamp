import { z } from "zod"
import { ImportArtifactIdSchema, MembershipIdSchema, MetricDraftIdSchema } from "./ids"
import { IsoDateTimeSchema } from "./values"

export const IMPORT_FORMATS = ["csv", "fit", "gpx", "tcx", "apple-xml", "samsung-json"] as const
export const ImportFormatSchema = z.enum(IMPORT_FORMATS)
export type ImportFormat = z.infer<typeof ImportFormatSchema>

export const IMPORT_QUALITY_FLAGS = [
  "device_reported",
  "estimated",
  "corrected",
  "partial",
  "timezone_inferred",
  "duplicate_suspected",
] as const
const ImportQualityFlagSchema = z.enum(IMPORT_QUALITY_FLAGS)

export function canonicalizeImportQualityFlags(
  flags: readonly z.infer<typeof ImportQualityFlagSchema>[],
) {
  return IMPORT_QUALITY_FLAGS.filter((flag) => flags.includes(flag))
}

const ImportQualityFlagsSchema = z
  .array(ImportQualityFlagSchema)
  .max(12)
  .transform(canonicalizeImportQualityFlags)
  .readonly()

const AcceptedMetricsSchema = z
  .object({
    distanceM: z.number().finite().positive().optional(),
    durationS: z.number().finite().positive().optional(),
    paceSecondsPerKm: z.number().finite().positive().optional(),
    averageHeartRateBpm: z.number().finite().min(20).max(250).optional(),
    maxHeartRateBpm: z.number().finite().min(20).max(250).optional(),
    steps: z.number().int().nonnegative().optional(),
    elevationGainM: z.number().finite().nonnegative().optional(),
  })
  .strict()
  .refine((metrics) => Object.keys(metrics).length > 0)
  .readonly()

const acceptedStructuredImportDraftShape = {
  programId: z.string().trim().min(3).max(120),
  participantId: MembershipIdSchema,
  format: ImportFormatSchema,
  observedAt: IsoDateTimeSchema,
  sourceFamily: z.string().trim().min(1).max(80),
  sourceModel: z.string().trim().min(1).max(120).optional(),
  timezone: z.literal("Asia/Seoul"),
  qualityFlags: ImportQualityFlagsSchema,
  metrics: AcceptedMetricsSchema,
} as const

export const AcceptedStructuredImportDraftSchema = z
  .object(acceptedStructuredImportDraftShape)
  .strict()
  .readonly()
export type AcceptedStructuredImportDraft = z.infer<typeof AcceptedStructuredImportDraftSchema>

export const AcceptedStructuredImportRecordSchema = z
  .object({
    ...acceptedStructuredImportDraftShape,
    id: ImportArtifactIdSchema,
    parserName: z.string().trim().min(1).max(120),
    parserVersion: z.string().trim().min(1).max(80),
    acceptedBy: MembershipIdSchema,
    acceptedAt: IsoDateTimeSchema,
    serverDuplicateHmac: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()
  .readonly()
export type AcceptedStructuredImportRecord = z.infer<typeof AcceptedStructuredImportRecordSchema>

export const ImportArtifactSchema = z
  .object({
    id: ImportArtifactIdSchema,
    participantId: MembershipIdSchema,
    format: ImportFormatSchema,
    originalFilename: z.string().trim().min(1).max(255),
    checksum: z.string().regex(/^[a-fA-F0-9]{8,128}$/),
    byteSize: z.number().int().nonnegative().max(100_000_000),
    importedAt: IsoDateTimeSchema,
    coverage: z.literal("representative_only").default("representative_only"),
  })
  .strict()
  .readonly()
export type ImportArtifact = z.infer<typeof ImportArtifactSchema>

export const DraftProvenanceSchema = z
  .object({
    adapter: ImportFormatSchema,
    sourceRecord: z.string().trim().min(1).max(200),
  })
  .strict()
  .readonly()
export type DraftProvenance = z.infer<typeof DraftProvenanceSchema>

const metricDraftBase = {
  id: MetricDraftIdSchema,
  artifactId: ImportArtifactIdSchema,
  participantId: MembershipIdSchema,
  observedAt: IsoDateTimeSchema,
  provenance: DraftProvenanceSchema,
  warnings: z
    .array(z.string().trim().min(1).max(200))
    .readonly()
    .default(["representative_adapter"]),
  status: z.literal("pending_review").default("pending_review"),
} as const

export const MetricDraftSchema = z.discriminatedUnion("metric", [
  z
    .object({
      ...metricDraftBase,
      metric: z.literal("distance"),
      unit: z.literal("m"),
      value: z.number().finite().positive(),
    })
    .strict()
    .readonly(),
  z
    .object({
      ...metricDraftBase,
      metric: z.literal("duration"),
      unit: z.literal("s"),
      value: z.number().finite().positive(),
    })
    .strict()
    .readonly(),
  z
    .object({
      ...metricDraftBase,
      metric: z.literal("heart_rate"),
      unit: z.literal("bpm"),
      value: z.number().finite().min(20).max(250),
    })
    .strict()
    .readonly(),
  z
    .object({
      ...metricDraftBase,
      metric: z.literal("steps"),
      unit: z.literal("count"),
      value: z.number().int().nonnegative(),
    })
    .strict()
    .readonly(),
])
export type MetricDraft = z.infer<typeof MetricDraftSchema>
