import {
  type HealthMetric,
  HealthMetricSchema,
  type Membership,
  MembershipSchema,
  type Organization,
  OrganizationSchema,
  type ParticipantMembership,
  ParticipantMembershipSchema,
  type ProgramInstance,
  ProgramInstanceSchema,
  type ProgramTemplate,
  ProgramTemplateSchema,
} from "../domain"

export type BootcampSeed = {
  readonly organization: Organization
  readonly template: ProgramTemplate
  readonly program: ProgramInstance
  readonly coach: Membership
  readonly participants: readonly ParticipantMembership[]
  readonly healthMetrics: readonly HealthMetric[]
}

export const SEEDED_ORGANIZATION = OrganizationSchema.parse({
  id: "organization-hanwha-life",
  name: "Hanwha Life",
  createdAt: "2026-08-01T09:00:00+09:00",
})

export const SEEDED_PROGRAM_TEMPLATE = ProgramTemplateSchema.parse({
  id: "template-run-change-nine-week",
  organizationId: SEEDED_ORGANIZATION.id,
  name: "RUN CHANGE",
  durationWeeks: 9,
  sessionsPerWeek: 2,
  supportedTimeTrials: ["12-minute", "3k", "5k"],
})

export const SEEDED_PROGRAM = ProgramInstanceSchema.parse({
  id: "program-run-change-2026",
  organizationId: SEEDED_ORGANIZATION.id,
  templateId: SEEDED_PROGRAM_TEMPLATE.id,
  name: "RUN CHANGE 2026",
  startsOn: "2026-08-24",
  endsOn: "2026-10-24",
  cohortSize: 20,
  timeTrial: { status: "undecided" },
})

export const SEEDED_COACH = MembershipSchema.parse({
  id: "membership-coach",
  organizationId: SEEDED_ORGANIZATION.id,
  programId: SEEDED_PROGRAM.id,
  userId: "user-coach",
  role: "coach",
  displayName: "Coach Kim",
  joinedAt: "2026-08-01T09:00:00+09:00",
  active: true,
})

export const SEEDED_PARTICIPANTS = Array.from({ length: 20 }, (_, index) => {
  const cohortNumber = index + 1
  const suffix = String(cohortNumber).padStart(2, "0")
  return ParticipantMembershipSchema.parse({
    id: `membership-participant-${suffix}`,
    organizationId: SEEDED_ORGANIZATION.id,
    programId: SEEDED_PROGRAM.id,
    userId: `user-participant-${suffix}`,
    role: "participant",
    displayName: `Participant ${suffix}`,
    cohortNumber,
    joinedAt: "2026-08-01T09:00:00+09:00",
    active: true,
  })
})

export const SEEDED_HEALTH_METRICS = SEEDED_PARTICIPANTS.map((participant) =>
  HealthMetricSchema.parse({
    id: `health-metric-${String(participant.cohortNumber).padStart(2, "0")}`,
    participantId: participant.id,
    metric: "resting_heart_rate",
    unit: "bpm",
    value: 54 + (participant.cohortNumber % 12),
    recordedAt: "2026-08-24T07:00:00+09:00",
    source: "manual",
  }),
)

export const BOOTCAMP_SEED = {
  organization: SEEDED_ORGANIZATION,
  template: SEEDED_PROGRAM_TEMPLATE,
  program: SEEDED_PROGRAM,
  coach: SEEDED_COACH,
  participants: SEEDED_PARTICIPANTS,
  healthMetrics: SEEDED_HEALTH_METRICS,
} satisfies BootcampSeed
