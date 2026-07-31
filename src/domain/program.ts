import { z } from "zod"
import {
  MembershipIdSchema,
  OrganizationIdSchema,
  ProgramInstanceIdSchema,
  ProgramTemplateIdSchema,
  UserIdSchema,
} from "./ids"
import { TIME_TRIAL_PROTOCOLS, TimeTrialStateSchema } from "./schedule"
import { IsoDateSchema, IsoDateTimeSchema, NonEmptyTextSchema } from "./values"

export const OrganizationSchema = z
  .object({
    id: OrganizationIdSchema,
    name: NonEmptyTextSchema.max(120),
    createdAt: IsoDateTimeSchema,
  })
  .strict()
  .readonly()
export type Organization = z.infer<typeof OrganizationSchema>

export const ProgramTemplateSchema = z
  .object({
    id: ProgramTemplateIdSchema,
    organizationId: OrganizationIdSchema,
    name: NonEmptyTextSchema.max(120),
    durationWeeks: z.literal(9),
    sessionsPerWeek: z.literal(2),
    supportedTimeTrials: z
      .tuple([z.literal("12-minute"), z.literal("3k"), z.literal("5k")])
      .readonly()
      .default(TIME_TRIAL_PROTOCOLS),
  })
  .strict()
  .readonly()
export type ProgramTemplate = z.infer<typeof ProgramTemplateSchema>

export const ProgramInstanceSchema = z
  .object({
    id: ProgramInstanceIdSchema,
    organizationId: OrganizationIdSchema,
    templateId: ProgramTemplateIdSchema,
    name: NonEmptyTextSchema.max(120),
    startsOn: IsoDateSchema,
    endsOn: IsoDateSchema,
    cohortSize: z.literal(20),
    timeTrial: TimeTrialStateSchema,
  })
  .strict()
  .refine((program) => program.endsOn >= program.startsOn, {
    message: "endsOn must not be before startsOn",
    path: ["endsOn"],
  })
  .readonly()
export type ProgramInstance = z.infer<typeof ProgramInstanceSchema>

const membershipBase = {
  id: MembershipIdSchema,
  organizationId: OrganizationIdSchema,
  programId: ProgramInstanceIdSchema,
  userId: UserIdSchema,
  displayName: NonEmptyTextSchema.max(80),
  joinedAt: IsoDateTimeSchema,
  active: z.boolean(),
} as const

export const ParticipantMembershipSchema = z
  .object({
    ...membershipBase,
    role: z.literal("participant"),
    cohortNumber: z.number().int().min(1).max(20),
  })
  .strict()
  .readonly()

const CoachMembershipSchema = z
  .object({ ...membershipBase, role: z.literal("coach") })
  .strict()
  .readonly()

const AdminMembershipSchema = z
  .object({ ...membershipBase, role: z.literal("admin") })
  .strict()
  .readonly()

const StakeholderMembershipSchema = z
  .object({ ...membershipBase, role: z.literal("stakeholder") })
  .strict()
  .readonly()

export const MembershipSchema = z.discriminatedUnion("role", [
  ParticipantMembershipSchema,
  CoachMembershipSchema,
  AdminMembershipSchema,
  StakeholderMembershipSchema,
])
export type Membership = z.infer<typeof MembershipSchema>
export type ParticipantMembership = z.infer<typeof ParticipantMembershipSchema>
