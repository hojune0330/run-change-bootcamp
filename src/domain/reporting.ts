import { z } from "zod"
import { EnrollmentIdSchema } from "./ids"
import { PLUS_RUN_2026_PROTOCOL } from "./plus-run-protocol"
import { percentileCont, roundOneDecimal } from "./statistics"
import { IsoDateTimeSchema, PositiveSecondsSchema } from "./values"

const TECHNICAL_REATTEMPT_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000

const AdherenceCountsSchema = z
  .object({
    assignedWhileActiveCount: z.number().int().nonnegative(),
    acceptedLinkedSessionCount: z.number().int().nonnegative(),
  })
  .strict()
  .refine((value) => value.acceptedLinkedSessionCount <= value.assignedWhileActiveCount, {
    message: "accepted linked sessions cannot exceed assigned sessions",
    path: ["acceptedLinkedSessionCount"],
  })
  .readonly()

const CohortParticipantSchema = z
  .object({
    enrollmentId: EnrollmentIdSchema,
    lifecycleStatus: z.enum(["onboarding", "active", "paused", "withdrawn", "completed", "ended"]),
    baselineSeconds: PositiveSecondsSchema.nullable(),
    retestSeconds: PositiveSecondsSchema.nullable(),
    adherence: AdherenceCountsSchema,
  })
  .strict()
  .readonly()

const CohortSchema = z.array(CohortParticipantSchema).readonly()

const OfficialAttemptCandidateSchema = z
  .object({
    attemptId: z.string().regex(/^[a-z][a-z0-9-]{2,119}$/),
    attemptKind: z.enum(["original", "technical_reattempt"]),
    originalAttemptId: z
      .string()
      .regex(/^[a-z][a-z0-9-]{2,119}$/)
      .nullable(),
    status: z.enum(["pending_review", "accepted", "rejected", "invalidated"]),
    invalidationReason: z.literal("technical_interruption").nullable(),
    elapsedSeconds: PositiveSecondsSchema,
    recordedAt: IsoDateTimeSchema,
  })
  .strict()
  .readonly()

const OfficialAttemptCandidatesSchema = z.array(OfficialAttemptCandidateSchema).readonly()
type OfficialAttemptCandidate = z.infer<typeof OfficialAttemptCandidateSchema>

export class AmbiguousOfficialAttemptError extends Error {
  readonly name = "AmbiguousOfficialAttemptError"
}

export type ThreeKilometerChange = {
  readonly rawChangePercent: number
  readonly improved: boolean
}

export type ThreeKilometerSummary = {
  readonly validPairCount: number
  readonly improvedCount: number
  readonly improvedPercentRaw: number | null
  readonly q1ChangePercentRaw: number | null
  readonly medianChangePercentRaw: number | null
  readonly q3ChangePercentRaw: number | null
  readonly q1ChangePercentDisplay: number | null
  readonly medianChangePercentDisplay: number | null
  readonly q3ChangePercentDisplay: number | null
  readonly productPositive: boolean
}

export type CohortSummary = ThreeKilometerSummary & {
  readonly allEnrolledCount: number
  readonly baselineCount: number
  readonly retestCount: number
  readonly perProtocolCount: number
  readonly withdrawnCount: number
}

export function calculateThreeKilometerChange(input: {
  readonly baselineSeconds: number
  readonly retestSeconds: number
}): ThreeKilometerChange {
  const parsed = z
    .object({ baselineSeconds: PositiveSecondsSchema, retestSeconds: PositiveSecondsSchema })
    .strict()
    .readonly()
    .parse(input)
  const rawChangePercent =
    (100 * (parsed.baselineSeconds - parsed.retestSeconds)) / parsed.baselineSeconds
  return { rawChangePercent, improved: rawChangePercent > 0 }
}

export function calculateAdherence(input: z.input<typeof AdherenceCountsSchema>): {
  readonly rawPercent: number | null
  readonly perProtocol: boolean
} {
  const parsed = AdherenceCountsSchema.parse(input)
  if (parsed.assignedWhileActiveCount === 0) {
    return { rawPercent: null, perProtocol: false }
  }
  const rawPercent = (100 * parsed.acceptedLinkedSessionCount) / parsed.assignedWhileActiveCount
  return { rawPercent, perProtocol: rawPercent >= PLUS_RUN_2026_PROTOCOL.perProtocolMinimumPercent }
}

export function selectOfficialAttempt(input: unknown): OfficialAttemptCandidate | null {
  const attempts = OfficialAttemptCandidatesSchema.parse(input)
  const originals = attempts.filter((attempt) => attempt.attemptKind === "original")
  if (originals.length > 1) {
    throw new AmbiguousOfficialAttemptError("an official session cannot have two original attempts")
  }
  const original = originals.at(0)
  if (original === undefined) return null
  if (original.status === "accepted") return original
  if (
    original.status !== "invalidated" ||
    original.invalidationReason !== "technical_interruption"
  ) {
    return null
  }
  const acceptedReattempts = attempts.filter((attempt) => {
    const elapsedSinceOriginalMs = Date.parse(attempt.recordedAt) - Date.parse(original.recordedAt)
    return (
      attempt.attemptKind === "technical_reattempt" &&
      attempt.originalAttemptId === original.attemptId &&
      attempt.status === "accepted" &&
      elapsedSinceOriginalMs > 0 &&
      elapsedSinceOriginalMs <= TECHNICAL_REATTEMPT_WINDOW_MS
    )
  })
  if (acceptedReattempts.length > 1) {
    throw new AmbiguousOfficialAttemptError("only one accepted technical reattempt is permitted")
  }
  return acceptedReattempts.at(0) ?? null
}

function summarizeChanges(changes: readonly ThreeKilometerChange[]): ThreeKilometerSummary {
  if (changes.length === 0) {
    return {
      validPairCount: 0,
      improvedCount: 0,
      improvedPercentRaw: null,
      q1ChangePercentRaw: null,
      medianChangePercentRaw: null,
      q3ChangePercentRaw: null,
      q1ChangePercentDisplay: null,
      medianChangePercentDisplay: null,
      q3ChangePercentDisplay: null,
      productPositive: false,
    }
  }
  const rawValues = changes.map((change) => change.rawChangePercent)
  const improvedCount = changes.filter((change) => change.improved).length
  const improvedPercentRaw = (100 * improvedCount) / changes.length
  const q1 = percentileCont(rawValues, 0.25)
  const median = percentileCont(rawValues, 0.5)
  const q3 = percentileCont(rawValues, 0.75)
  return {
    validPairCount: changes.length,
    improvedCount,
    improvedPercentRaw,
    q1ChangePercentRaw: q1,
    medianChangePercentRaw: median,
    q3ChangePercentRaw: q3,
    q1ChangePercentDisplay: roundOneDecimal(q1),
    medianChangePercentDisplay: roundOneDecimal(median),
    q3ChangePercentDisplay: roundOneDecimal(q3),
    productPositive:
      changes.length >= PLUS_RUN_2026_PROTOCOL.minimumValidPairs &&
      median >= PLUS_RUN_2026_PROTOCOL.minimumMedianChangePercent &&
      improvedPercentRaw >= PLUS_RUN_2026_PROTOCOL.minimumImprovedPercent,
  }
}

export function summarizeCohort(input: unknown): CohortSummary {
  const participants = CohortSchema.parse(input)
  const changes: ThreeKilometerChange[] = []
  let perProtocolCount = 0
  for (const participant of participants) {
    if (participant.baselineSeconds !== null && participant.retestSeconds !== null) {
      changes.push(
        calculateThreeKilometerChange({
          baselineSeconds: participant.baselineSeconds,
          retestSeconds: participant.retestSeconds,
        }),
      )
      if (calculateAdherence(participant.adherence).perProtocol) {
        perProtocolCount += 1
      }
    }
  }
  return {
    ...summarizeChanges(changes),
    allEnrolledCount: participants.length,
    baselineCount: participants.filter((participant) => participant.baselineSeconds !== null)
      .length,
    retestCount: participants.filter((participant) => participant.retestSeconds !== null).length,
    perProtocolCount,
    withdrawnCount: participants.filter(
      (participant) => participant.lifecycleStatus === "withdrawn",
    ).length,
  }
}
