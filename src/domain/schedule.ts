import { z } from "zod"
import { MembershipIdSchema } from "./ids"
import { IsoDateSchema, IsoDateTimeSchema } from "./values"

export const TIME_TRIAL_PROTOCOLS = ["12-minute", "3k", "5k"] as const
export const TimeTrialProtocolSchema = z.enum(TIME_TRIAL_PROTOCOLS)
export type TimeTrialProtocol = z.infer<typeof TimeTrialProtocolSchema>

export const UndecidedTimeTrialSchema = z
  .object({
    status: z.literal("undecided"),
    candidateSessions: z
      .tuple([z.literal(1), z.literal(2)])
      .readonly()
      .default([1, 2]),
    protocols: z
      .tuple([z.literal("12-minute"), z.literal("3k"), z.literal("5k")])
      .readonly()
      .default(TIME_TRIAL_PROTOCOLS),
  })
  .strict()
  .readonly()

export const TimeTrialDecisionSchema = z
  .object({
    status: z.literal("decided"),
    session: z.union([z.literal(1), z.literal(2)]),
    protocol: TimeTrialProtocolSchema,
    decidedAt: IsoDateTimeSchema,
    decidedBy: MembershipIdSchema,
  })
  .strict()
  .readonly()

export const TimeTrialStateSchema = z.discriminatedUnion("status", [
  UndecidedTimeTrialSchema,
  TimeTrialDecisionSchema,
])
export type TimeTrialState = z.infer<typeof TimeTrialStateSchema>

const WEEKS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
type ProgramWeek = (typeof WEEKS)[number]

type SessionSlot = {
  readonly week: ProgramWeek
  readonly session: 1 | 2
  readonly scheduledOn: z.infer<typeof IsoDateSchema>
}

export type ScheduledSession = SessionSlot &
  (
    | {
        readonly kind: "initial_time_trial_candidate"
        readonly protocols: typeof TIME_TRIAL_PROTOCOLS
      }
    | { readonly kind: "initial_time_trial"; readonly protocol: TimeTrialProtocol }
    | { readonly kind: "onboarding_easy" }
    | { readonly kind: "recovery_technique" }
    | { readonly kind: "standard"; readonly focus: string }
    | {
        readonly kind: "time_trial_retest_pending"
        readonly protocols: typeof TIME_TRIAL_PROTOCOLS
      }
    | { readonly kind: "time_trial_retest"; readonly protocol: TimeTrialProtocol }
  )

const ScheduleInputSchema = z
  .object({
    startsOn: IsoDateSchema,
    decision: TimeTrialStateSchema,
  })
  .strict()

class UnexpectedTimeTrialStateError extends Error {
  readonly name = "UnexpectedTimeTrialStateError"
}

function assertNever(value: never): never {
  throw new UnexpectedTimeTrialStateError(`Unexpected time-trial state: ${String(value)}`)
}

function dateAtOffset(startsOn: z.infer<typeof IsoDateSchema>, offsetDays: number) {
  const date = new Date(`${startsOn}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offsetDays)
  return IsoDateSchema.parse(date.toISOString().slice(0, 10))
}

function slotFor(startsOn: z.infer<typeof IsoDateSchema>, week: ProgramWeek, session: 1 | 2) {
  const offsetDays = (week - 1) * 7 + (session === 1 ? 1 : 3)
  return { week, session, scheduledOn: dateAtOffset(startsOn, offsetDays) } satisfies SessionSlot
}

function initialSessions(
  startsOn: z.infer<typeof IsoDateSchema>,
  decision: TimeTrialState,
): readonly ScheduledSession[] {
  const first = slotFor(startsOn, 1, 1)
  const second = slotFor(startsOn, 1, 2)
  switch (decision.status) {
    case "undecided":
      return [
        { ...first, kind: "initial_time_trial_candidate", protocols: TIME_TRIAL_PROTOCOLS },
        { ...second, kind: "initial_time_trial_candidate", protocols: TIME_TRIAL_PROTOCOLS },
      ]
    case "decided":
      switch (decision.session) {
        case 1:
          return [
            { ...first, kind: "initial_time_trial", protocol: decision.protocol },
            { ...second, kind: "recovery_technique" },
          ]
        case 2:
          return [
            { ...first, kind: "onboarding_easy" },
            { ...second, kind: "initial_time_trial", protocol: decision.protocol },
          ]
        default:
          return assertNever(decision.session)
      }
    default:
      return assertNever(decision)
  }
}

function sessionsForWeek(
  startsOn: z.infer<typeof IsoDateSchema>,
  week: Exclude<ProgramWeek, 1>,
  decision: TimeTrialState,
): readonly ScheduledSession[] {
  const first = slotFor(startsOn, week, 1)
  const second = slotFor(startsOn, week, 2)
  if (week !== 8) {
    return [
      { ...first, kind: "standard", focus: `week-${week}-session-1` },
      { ...second, kind: "standard", focus: `week-${week}-session-2` },
    ]
  }
  const preparation = { ...first, kind: "standard", focus: "retest-preparation" } as const
  switch (decision.status) {
    case "undecided":
      return [
        preparation,
        { ...second, kind: "time_trial_retest_pending", protocols: TIME_TRIAL_PROTOCOLS },
      ]
    case "decided":
      return [preparation, { ...second, kind: "time_trial_retest", protocol: decision.protocol }]
    default:
      return assertNever(decision)
  }
}

export function buildNineWeekSchedule(input: unknown): readonly ScheduledSession[] {
  const parsed = ScheduleInputSchema.parse(input)
  return WEEKS.flatMap((week) =>
    week === 1
      ? initialSessions(parsed.startsOn, parsed.decision)
      : sessionsForWeek(parsed.startsOn, week, parsed.decision),
  )
}
