import { deidentifyText } from "./ai-safety"

const METRIC_TYPES = new Set<string>([
  "distance_m",
  "duration_s",
  "pace_s_per_km",
  "heart_rate_bpm",
  "weight_kg",
  "body_fat_pct",
  "pain_score",
  "other",
])
const METRIC_UNITS = new Set<string>(["m", "s", "s/km", "bpm", "kg", "%", "score"])
const FEEDBACK_CLASSIFICATIONS = new Set<string>(["low_risk", "training_change", "pain", "risk"])

type ProviderResponseError = { readonly ok: false; readonly error: "invalid_provider_response" }

export type MetricDraft = {
  readonly metricType: string
  readonly value: number
  readonly unit: string
  readonly observedAt: string | null
  readonly confidence: number
  readonly verificationStatus: "draft"
}

export type FeedbackDraft = {
  readonly draftText: string
  readonly classification: "low_risk" | "training_change" | "pain" | "risk"
  readonly status: "pending_approval"
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input)
}

function isMetricType(value: unknown): value is string {
  return typeof value === "string" && METRIC_TYPES.has(value)
}

function isMetricUnit(value: unknown): value is string {
  return typeof value === "string" && METRIC_UNITS.has(value)
}

function parseMetric(input: unknown): MetricDraft | null {
  if (!isRecord(input)) return null
  const { metricType, value, unit, observedAt, confidence } = input
  if (!isMetricType(metricType) || !isMetricUnit(unit)) return null
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1_000_000_000) {
    return null
  }
  if (typeof confidence !== "number" || confidence < 0 || confidence > 1) return null
  if (
    observedAt !== null &&
    (typeof observedAt !== "string" || !Number.isFinite(Date.parse(observedAt)))
  ) {
    return null
  }
  return {
    metricType,
    value,
    unit,
    observedAt,
    confidence,
    verificationStatus: "draft",
  }
}

export function parseMetricDraftOutput(
  input: unknown,
): { readonly ok: true; readonly value: readonly MetricDraft[] } | ProviderResponseError {
  if (!isRecord(input)) {
    return { ok: false, error: "invalid_provider_response" }
  }
  const { metrics: rawMetrics } = input
  if (!Array.isArray(rawMetrics)) {
    return { ok: false, error: "invalid_provider_response" }
  }
  if (rawMetrics.length < 1 || rawMetrics.length > 10) {
    return { ok: false, error: "invalid_provider_response" }
  }
  const metrics: MetricDraft[] = []
  for (const rawMetric of rawMetrics) {
    const metric = parseMetric(rawMetric)
    if (metric === null) return { ok: false, error: "invalid_provider_response" }
    metrics.push(metric)
  }
  return { ok: true, value: metrics }
}

export function parseFeedbackDraftOutput(
  input: unknown,
): { readonly ok: true; readonly value: FeedbackDraft } | ProviderResponseError {
  if (!isRecord(input)) return { ok: false, error: "invalid_provider_response" }
  const { draftText, classification } = input
  if (typeof draftText !== "string" || draftText.trim().length < 1 || draftText.length > 2_000) {
    return { ok: false, error: "invalid_provider_response" }
  }
  if (typeof classification !== "string" || !FEEDBACK_CLASSIFICATIONS.has(classification)) {
    return { ok: false, error: "invalid_provider_response" }
  }
  if (
    classification !== "low_risk" &&
    classification !== "training_change" &&
    classification !== "pain" &&
    classification !== "risk"
  ) {
    return { ok: false, error: "invalid_provider_response" }
  }
  return {
    ok: true,
    value: {
      draftText: deidentifyText(draftText.trim()),
      classification,
      status: "pending_approval",
    },
  }
}
