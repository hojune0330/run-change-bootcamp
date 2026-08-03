import { z } from "zod"
import {
  allPresent,
  anyPresent,
  DateTimeOrNull,
  PrivacyIdSchema,
  ProfileRefOrNull,
  ProgramRefSchema,
  purgeMatches,
} from "./privacy-audiences-core"
import { IsoDateTimeSchema } from "./values"

export const FaqRedactionProposalSchema = z
  .object({
    id: PrivacyIdSchema,
    threadId: PrivacyIdSchema,
    programId: ProgramRefSchema,
    proposedByProfileId: PrivacyIdSchema,
    redactedQuestion: z.string().trim().min(1).max(2_000),
    redactedAnswer: z.string().trim().min(1).max(3_000),
    redactedCopySha256: z.string().regex(/^[0-9a-f]{64}$/),
    reviewStatus: z.enum(["pending", "approved", "rejected"]).default("pending"),
    reviewedByProfileId: ProfileRefOrNull.optional(),
    reviewedAt: DateTimeOrNull,
    reviewControl: z.literal("named_staff_redaction_review").nullable().optional(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict()
  .readonly()
  .superRefine((proposal, context) => {
    const reviewFields = [proposal.reviewedByProfileId, proposal.reviewedAt, proposal.reviewControl]
    const reviewed =
      allPresent(reviewFields) && proposal.reviewControl === "named_staff_redaction_review"
    if (proposal.reviewStatus === "pending" && anyPresent(reviewFields))
      context.addIssue({
        code: "custom",
        path: ["reviewStatus"],
        message: "pending proposal cannot contain review metadata",
      })
    if (proposal.reviewStatus !== "pending" && !reviewed)
      context.addIssue({
        code: "custom",
        path: ["reviewStatus"],
        message: "reviewed proposal requires complete named staff review metadata",
      })
    if (
      proposal.reviewStatus !== "pending" &&
      proposal.reviewedAt != null &&
      Date.parse(proposal.reviewedAt) < Date.parse(proposal.createdAt)
    )
      context.addIssue({
        code: "custom",
        path: ["reviewedAt"],
        message: "review cannot precede proposal creation",
      })
  })
export type FaqRedactionProposal = z.infer<typeof FaqRedactionProposalSchema>

export const FaqParticipantOptInSchema = z
  .object({
    id: PrivacyIdSchema,
    proposalId: PrivacyIdSchema,
    threadId: PrivacyIdSchema,
    programId: ProgramRefSchema,
    participantProfileId: PrivacyIdSchema,
    copySha256: z.string().regex(/^[0-9a-f]{64}$/),
    optedInAt: IsoDateTimeSchema,
    status: z.enum(["active", "withdrawn"]).default("active"),
    withdrawnAt: DateTimeOrNull,
    withdrawnByProfileId: ProfileRefOrNull.optional(),
    withdrawalReasonCode: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/^[a-z][a-z0-9_]{2,79}$/)
      .nullable()
      .optional(),
    createdAt: IsoDateTimeSchema,
  })
  .strict()
  .readonly()
  .superRefine((optIn, context) => {
    const withdrawn = [
      optIn.withdrawnAt,
      optIn.withdrawnByProfileId,
      optIn.withdrawalReasonCode,
    ].some((value) => value != null)
    if (optIn.status === "active" && withdrawn)
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "active opt-in cannot contain withdrawal metadata",
      })
    if (
      optIn.status === "withdrawn" &&
      ![optIn.withdrawnAt, optIn.withdrawnByProfileId, optIn.withdrawalReasonCode].every(
        (value) => value != null,
      )
    )
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "withdrawn opt-in requires complete withdrawal metadata",
      })
    if (optIn.status === "withdrawn" && optIn.withdrawnByProfileId !== optIn.participantProfileId)
      context.addIssue({
        code: "custom",
        path: ["withdrawnByProfileId"],
        message: "only the participant may withdraw the FAQ opt-in",
      })
    if (
      optIn.status === "withdrawn" &&
      optIn.withdrawnAt != null &&
      Date.parse(optIn.withdrawnAt) < Date.parse(optIn.optedInAt)
    )
      context.addIssue({
        code: "custom",
        path: ["withdrawnAt"],
        message: "withdrawal cannot precede opt-in",
      })
  })
export type FaqParticipantOptIn = z.infer<typeof FaqParticipantOptInSchema>

export const AnonymousFaqCopySchema = z
  .object({
    id: PrivacyIdSchema,
    programId: ProgramRefSchema,
    sourceThreadId: PrivacyIdSchema,
    sourceProposalId: PrivacyIdSchema,
    participantOptInId: PrivacyIdSchema,
    questionCopy: z.string().trim().min(1).max(2_000),
    answerCopy: z.string().trim().min(1).max(3_000),
    audience: z.literal("anonymous").default("anonymous"),
    publicationStatus: z.enum(["published", "unpublished"]).default("published"),
    publishedByProfileId: PrivacyIdSchema,
    participantProfileId: PrivacyIdSchema.optional(),
    publishedAt: IsoDateTimeSchema,
    unpublishedByProfileId: ProfileRefOrNull.optional(),
    unpublishedAt: DateTimeOrNull,
    purgeAfter: DateTimeOrNull,
    createdAt: IsoDateTimeSchema,
  })
  .strict()
  .readonly()
  .superRefine((copy, context) => {
    const reversal = [copy.unpublishedByProfileId, copy.unpublishedAt, copy.purgeAfter]
    const unpublished = allPresent(reversal) && purgeMatches(copy.unpublishedAt, copy.purgeAfter)
    if (copy.publicationStatus === "published" && anyPresent(reversal))
      context.addIssue({
        code: "custom",
        path: ["publicationStatus"],
        message: "published FAQ cannot contain reversal metadata",
      })
    if (copy.publicationStatus === "unpublished" && !unpublished)
      context.addIssue({
        code: "custom",
        path: ["publicationStatus"],
        message: "unpublished FAQ requires complete exact reversal metadata",
      })
    if (
      copy.publicationStatus === "unpublished" &&
      copy.unpublishedAt != null &&
      Date.parse(copy.unpublishedAt) < Date.parse(copy.publishedAt)
    )
      context.addIssue({
        code: "custom",
        path: ["unpublishedAt"],
        message: "unpublication cannot precede publication",
      })
  })
export type AnonymousFaqCopy = z.infer<typeof AnonymousFaqCopySchema>
export const AnonymousFaqProjectionSchema = z
  .object({
    id: PrivacyIdSchema,
    programId: ProgramRefSchema,
    questionCopy: z.string().trim().min(1).max(2_000),
    answerCopy: z.string().trim().min(1).max(3_000),
    audience: z.literal("anonymous"),
    publishedAt: IsoDateTimeSchema,
  })
  .strict()
  .readonly()
export type AnonymousFaqProjection = z.infer<typeof AnonymousFaqProjectionSchema>
