import { z } from "zod"

export const PlusRunProtocolSchema = z
  .object({
    code: z.literal("plus_run_complete_2026"),
    version: z.literal(1),
    timezone: z.literal("Asia/Seoul"),
    scheduleAnchorOn: z.literal("2026-08-24"),
    programStartOn: z.literal("2026-08-24"),
    onboardingOn: z.literal("2026-08-25"),
    officialBaselineOn: z.literal("2026-08-27"),
    restingHeartRateBaseline: z
      .object({ startOn: z.literal("2026-08-17"), endOn: z.literal("2026-08-23") })
      .strict()
      .readonly(),
    restingHeartRateComparison: z
      .object({ startOn: z.literal("2026-10-08"), endOn: z.literal("2026-10-14") })
      .strict()
      .readonly(),
    interventionEndpointOn: z.literal("2026-10-15"),
    officialRetestOn: z.literal("2026-10-15"),
    administrativeEndOn: z.literal("2026-10-24"),
    festivalOn: z.literal("2026-10-24"),
    distanceMeters: z.literal(3_000),
    minimumValidPairs: z.literal(15),
    minimumMedianChangePercent: z.literal(3),
    minimumImprovedPercent: z.literal(60),
    perProtocolMinimumPercent: z.literal(80),
    minimumRestingHeartRateDays: z.literal(3),
  })
  .strict()
  .readonly()

export const PLUS_RUN_2026_PROTOCOL = PlusRunProtocolSchema.parse({
  code: "plus_run_complete_2026",
  version: 1,
  timezone: "Asia/Seoul",
  scheduleAnchorOn: "2026-08-24",
  programStartOn: "2026-08-24",
  onboardingOn: "2026-08-25",
  officialBaselineOn: "2026-08-27",
  restingHeartRateBaseline: { startOn: "2026-08-17", endOn: "2026-08-23" },
  restingHeartRateComparison: { startOn: "2026-10-08", endOn: "2026-10-14" },
  interventionEndpointOn: "2026-10-15",
  officialRetestOn: "2026-10-15",
  administrativeEndOn: "2026-10-24",
  festivalOn: "2026-10-24",
  distanceMeters: 3_000,
  minimumValidPairs: 15,
  minimumMedianChangePercent: 3,
  minimumImprovedPercent: 60,
  perProtocolMinimumPercent: 80,
  minimumRestingHeartRateDays: 3,
})

export type PlusRunProtocol = z.infer<typeof PlusRunProtocolSchema>
