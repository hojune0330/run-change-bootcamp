import { z } from "zod"
import { HealthMetricIdSchema, MembershipIdSchema } from "./ids"
import { IsoDateTimeSchema } from "./values"

const healthMetricBase = {
  id: HealthMetricIdSchema,
  participantId: MembershipIdSchema,
  recordedAt: IsoDateTimeSchema,
  source: z.enum(["manual", "import", "screenshot"]),
  visibility: z.literal("private").default("private"),
} as const

const RestingHeartRateSchema = z
  .object({
    ...healthMetricBase,
    metric: z.literal("resting_heart_rate"),
    unit: z.literal("bpm"),
    value: z.number().finite().min(20).max(250),
  })
  .strict()
  .readonly()

const BodyWeightSchema = z
  .object({
    ...healthMetricBase,
    metric: z.literal("body_weight"),
    unit: z.literal("kg"),
    value: z.number().finite().min(20).max(400),
  })
  .strict()
  .readonly()

const SleepDurationSchema = z
  .object({
    ...healthMetricBase,
    metric: z.literal("sleep_duration"),
    unit: z.literal("min"),
    value: z.number().finite().nonnegative().max(1_440),
  })
  .strict()
  .readonly()

const PainScoreSchema = z
  .object({
    ...healthMetricBase,
    metric: z.literal("pain_score"),
    unit: z.literal("score"),
    value: z.number().int().min(0).max(10),
  })
  .strict()
  .readonly()

export const HealthMetricSchema = z.discriminatedUnion("metric", [
  RestingHeartRateSchema,
  BodyWeightSchema,
  SleepDurationSchema,
  PainScoreSchema,
])
export type HealthMetric = z.infer<typeof HealthMetricSchema>
