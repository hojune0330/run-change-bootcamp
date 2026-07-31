export const PARTICIPANT_PROGRESS_STATES = ["on_track", "check_in_due", "starting"] as const
export type ParticipantProgressState = (typeof PARTICIPANT_PROGRESS_STATES)[number]

export const RUNNING_EXPERIENCE_LEVELS = ["starter", "returning", "steady"] as const
export type RunningExperienceLevel = (typeof RUNNING_EXPERIENCE_LEVELS)[number]

export const TIME_TRIAL_PROTOCOLS = ["12-minute", "3k", "5k"] as const
export type TimeTrialProtocol = (typeof TIME_TRIAL_PROTOCOLS)[number]

export type DemoParticipant = {
  readonly cohortNumber: number
  readonly completionPercent: number
  readonly displayName: string
  readonly experienceLevel: RunningExperienceLevel
  readonly id: `participant-${string}`
  readonly latestCheckInAt?: string
  readonly progressState: ParticipantProgressState
  readonly sharedSummary?: string
}

export type PendingTimeTrialDecision = {
  readonly candidateSessions: readonly [1, 2]
  readonly protocols: readonly TimeTrialProtocol[]
  readonly status: "pending"
}

export type DemoProgram = {
  readonly cohortSize: 20
  readonly endsOn: string
  readonly id: `program-${string}`
  readonly initialTimeTrial: PendingTimeTrialDecision
  readonly name: string
  readonly participants: readonly DemoParticipant[]
  readonly sponsor: string
  readonly startsOn: string
}
