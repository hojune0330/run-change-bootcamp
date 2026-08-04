import { z } from "zod"
import {
  AssessmentAttemptIdSchema,
  AssessmentProtocolVersionIdSchema,
  AssessmentResultIdSchema,
  AssessmentSessionIdSchema,
  EnrollmentIdSchema,
  MembershipIdSchema,
  ProgramInstanceIdSchema,
} from "./ids"
import {
  IsoDateSchema,
  IsoDateTimeSchema,
  PositiveMetersSchema,
  PositiveSecondsSchema,
} from "./values"

const TwelveMinuteProtocolSchema = z
  .object({ kind: z.literal("12-minute"), durationSeconds: z.literal(720).default(720) })
  .strict()
  .readonly()
const ThreeKilometerProtocolSchema = z
  .object({ kind: z.literal("3k"), distanceMeters: z.literal(3_000).default(3_000) })
  .strict()
  .readonly()
const FiveKilometerProtocolSchema = z
  .object({ kind: z.literal("5k"), distanceMeters: z.literal(5_000).default(5_000) })
  .strict()
  .readonly()

export const AssessmentProtocolSchema = z.discriminatedUnion("kind", [
  TwelveMinuteProtocolSchema,
  ThreeKilometerProtocolSchema,
  FiveKilometerProtocolSchema,
])
export type AssessmentProtocol = z.infer<typeof AssessmentProtocolSchema>

export const AssessmentSessionSchema = z
  .object({
    id: AssessmentSessionIdSchema,
    programId: ProgramInstanceIdSchema,
    protocolVersionId: AssessmentProtocolVersionIdSchema,
    purpose: z.enum(["initial", "retest"]),
    week: z.union([z.literal(1), z.literal(8)]),
    session: z.union([z.literal(1), z.literal(2)]),
    scheduledOn: IsoDateSchema,
    protocol: AssessmentProtocolSchema,
  })
  .strict()
  .refine(
    (session) =>
      (session.purpose === "initial" && session.week === 1) ||
      (session.purpose === "retest" && session.week === 8),
    { message: "assessment purpose must match its program week", path: ["week"] },
  )
  .readonly()
export type AssessmentSession = z.infer<typeof AssessmentSessionSchema>

export const AssessmentAttemptConditionsSchema = z
  .object({
    routeVersion: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,79}$/),
    measuredDistanceMeters: z.literal(3_000),
    surfaceKey: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/),
    timingMethodKey: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/),
    warmupProtocolKey: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/),
    startedLocalTime: z.iso.time({ precision: 0 }),
    timezone: z.literal("Asia/Seoul"),
    sourceFamily: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/),
    deviceFamily: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/),
  })
  .strict()
  .readonly()
export type AssessmentAttemptConditions = z.infer<typeof AssessmentAttemptConditionsSchema>

const attemptBase = {
  id: AssessmentAttemptIdSchema,
  assessmentSessionId: AssessmentSessionIdSchema,
  protocolVersionId: AssessmentProtocolVersionIdSchema,
  enrollmentId: EnrollmentIdSchema,
  elapsedSeconds: PositiveSecondsSchema,
  recordedAt: IsoDateTimeSchema,
  conditions: AssessmentAttemptConditionsSchema,
} as const

export const AssessmentAttemptSchema = z
  .discriminatedUnion("attemptKind", [
    z
      .object({
        ...attemptBase,
        attemptKind: z.literal("original"),
        originalAttemptId: z.null(),
        status: z.enum(["pending_review", "accepted", "rejected", "invalidated"]),
        invalidationReason: z.literal("technical_interruption").nullable(),
      })
      .strict()
      .readonly(),
    z
      .object({
        ...attemptBase,
        attemptKind: z.literal("technical_reattempt"),
        originalAttemptId: AssessmentAttemptIdSchema,
        status: z.enum(["pending_review", "accepted", "rejected"]),
        invalidationReason: z.null(),
      })
      .strict()
      .readonly(),
  ])
  .refine(
    (attempt) =>
      attempt.attemptKind !== "original" ||
      (attempt.status === "invalidated") ===
        (attempt.invalidationReason === "technical_interruption"),
    {
      message: "only an invalidated original may document a technical interruption",
      path: ["invalidationReason"],
    },
  )
export type AssessmentAttempt = z.infer<typeof AssessmentAttemptSchema>

const resultBase = {
  id: AssessmentResultIdSchema,
  assessmentSessionId: AssessmentSessionIdSchema,
  participantId: MembershipIdSchema,
  status: z.enum(["pending_review", "confirmed"]),
  recordedAt: IsoDateTimeSchema,
} as const

export const AssessmentResultSchema = z.discriminatedUnion("protocol", [
  z
    .object({
      ...resultBase,
      protocol: z.literal("12-minute"),
      distanceMeters: PositiveMetersSchema,
    })
    .strict()
    .readonly(),
  z
    .object({ ...resultBase, protocol: z.literal("3k"), elapsedSeconds: PositiveSecondsSchema })
    .strict()
    .readonly(),
  z
    .object({ ...resultBase, protocol: z.literal("5k"), elapsedSeconds: PositiveSecondsSchema })
    .strict()
    .readonly(),
])
export type AssessmentResult = z.infer<typeof AssessmentResultSchema>
