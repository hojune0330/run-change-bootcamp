import { z } from "zod"
import {
  AssessmentResultIdSchema,
  AssessmentSessionIdSchema,
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
