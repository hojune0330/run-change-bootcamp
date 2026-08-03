import type { z } from "zod"
import { type PrivateQuestionThread, plusDays } from "./privacy-audiences-core"
import { PrivacyTransitionError } from "./privacy-audiences-errors"
import {
  type AnonymousFaqCopy,
  AnonymousFaqCopySchema,
  type AnonymousFaqProjection,
  AnonymousFaqProjectionSchema,
  type FaqParticipantOptIn,
  FaqParticipantOptInSchema,
  type FaqRedactionProposal,
  FaqRedactionProposalSchema,
} from "./privacy-audiences-faq"
import type { IsoDateTimeSchema } from "./values"

export function reviewFaqRedactionProposal(input: {
  readonly proposal: FaqRedactionProposal
  readonly reviewerProfileId: string
  readonly authorizedStaffProfileId: string
  readonly decision: "approved" | "rejected"
  readonly reviewedAt: z.infer<typeof IsoDateTimeSchema>
}): FaqRedactionProposal {
  if (input.proposal.reviewStatus !== "pending")
    throw new PrivacyTransitionError("invalid_transition")
  if (input.reviewerProfileId !== input.authorizedStaffProfileId)
    throw new PrivacyTransitionError("forbidden")
  return FaqRedactionProposalSchema.parse({
    ...input.proposal,
    reviewStatus: input.decision,
    reviewedByProfileId: input.reviewerProfileId,
    reviewedAt: input.reviewedAt,
    reviewControl: "named_staff_redaction_review",
    updatedAt: input.reviewedAt,
  })
}
export function optInToFaq(input: {
  readonly proposal: FaqRedactionProposal
  readonly thread: PrivateQuestionThread
  readonly actorProfileId: string
  readonly participantProfileId: string
  readonly threadId: string
  readonly programId: string
  readonly copySha256: string
  readonly optedInAt: z.infer<typeof IsoDateTimeSchema>
  readonly id: string
  readonly createdAt: z.infer<typeof IsoDateTimeSchema>
}): FaqParticipantOptIn {
  if (
    input.proposal.reviewStatus !== "approved" ||
    input.copySha256 !== input.proposal.redactedCopySha256 ||
    input.threadId !== input.proposal.threadId ||
    input.programId !== input.proposal.programId ||
    input.thread.id !== input.proposal.threadId ||
    input.thread.programId !== input.proposal.programId ||
    input.thread.status === "archived" ||
    input.thread.status === "deleted" ||
    ["health", "reflection", "pain"].includes(input.thread.contentOrigin) ||
    input.participantProfileId !== input.thread.participantProfileId ||
    input.actorProfileId !== input.thread.participantProfileId
  )
    throw new PrivacyTransitionError("exact_copy_required")
  return FaqParticipantOptInSchema.parse({
    id: input.id,
    proposalId: input.proposal.id,
    threadId: input.threadId,
    programId: input.programId,
    participantProfileId: input.participantProfileId,
    copySha256: input.copySha256,
    optedInAt: input.optedInAt,
    status: "active",
    createdAt: input.createdAt,
  })
}
export function publishAnonymousFaq(input: {
  readonly id: string
  readonly proposal: FaqRedactionProposal
  readonly optIn: FaqParticipantOptIn
  readonly thread: PrivateQuestionThread
  readonly publishedByProfileId: string
  readonly activeNamedCoachProfileId: string
  readonly publishedAt: z.infer<typeof IsoDateTimeSchema>
  readonly createdAt: z.infer<typeof IsoDateTimeSchema>
}): AnonymousFaqCopy {
  if (
    input.proposal.reviewStatus !== "approved" ||
    input.optIn.status !== "active" ||
    input.optIn.copySha256 !== input.proposal.redactedCopySha256 ||
    input.proposal.threadId !== input.thread.id ||
    input.proposal.programId !== input.thread.programId ||
    input.optIn.proposalId !== input.proposal.id ||
    input.optIn.threadId !== input.thread.id ||
    input.optIn.programId !== input.thread.programId ||
    input.optIn.participantProfileId !== input.thread.participantProfileId
  )
    throw new PrivacyTransitionError("exact_copy_required")
  if (input.publishedByProfileId !== input.activeNamedCoachProfileId)
    throw new PrivacyTransitionError("forbidden")
  if (["health", "reflection", "pain"].includes(input.thread.contentOrigin))
    throw new PrivacyTransitionError("sensitive_source")
  if (input.thread.status === "archived" || input.thread.status === "deleted")
    throw new PrivacyTransitionError("invalid_transition")
  return AnonymousFaqCopySchema.parse({
    id: input.id,
    programId: input.thread.programId,
    sourceThreadId: input.thread.id,
    sourceProposalId: input.proposal.id,
    participantOptInId: input.optIn.id,
    participantProfileId: input.optIn.participantProfileId,
    questionCopy: input.proposal.redactedQuestion,
    answerCopy: input.proposal.redactedAnswer,
    audience: "anonymous",
    publicationStatus: "published",
    publishedByProfileId: input.publishedByProfileId,
    publishedAt: input.publishedAt,
    createdAt: input.createdAt,
  })
}
export function unpublishAnonymousFaq(input: {
  readonly copy: AnonymousFaqCopy
  readonly actorProfileId: string
  readonly unpublishedAt: z.infer<typeof IsoDateTimeSchema>
  readonly optIn?: FaqParticipantOptIn
  readonly activeNamedCoachProfileId?: string
}): AnonymousFaqCopy {
  if (input.copy.publicationStatus !== "published" || input.actorProfileId.length < 3)
    throw new PrivacyTransitionError("invalid_transition")
  const optInMatches =
    input.optIn !== undefined &&
    input.optIn.id === input.copy.participantOptInId &&
    input.optIn.proposalId === input.copy.sourceProposalId &&
    input.optIn.threadId === input.copy.sourceThreadId &&
    input.optIn.programId === input.copy.programId &&
    input.optIn.participantProfileId === input.copy.participantProfileId
  const participantAllowed =
    input.copy.participantProfileId !== undefined &&
    input.actorProfileId === input.copy.participantProfileId &&
    optInMatches
  const namedStaffAllowed =
    input.activeNamedCoachProfileId !== undefined &&
    input.actorProfileId === input.copy.publishedByProfileId &&
    input.actorProfileId === input.activeNamedCoachProfileId
  if (!participantAllowed && !namedStaffAllowed) throw new PrivacyTransitionError("forbidden")
  return AnonymousFaqCopySchema.parse({
    ...input.copy,
    publicationStatus: "unpublished",
    unpublishedByProfileId: input.actorProfileId,
    unpublishedAt: input.unpublishedAt,
    purgeAfter: plusDays(input.unpublishedAt, 30),
  })
}
export function toAnonymousFaqProjection(copy: AnonymousFaqCopy): AnonymousFaqProjection {
  if (copy.publicationStatus !== "published") throw new PrivacyTransitionError("invalid_transition")
  return AnonymousFaqProjectionSchema.parse({
    id: copy.id,
    programId: copy.programId,
    questionCopy: copy.questionCopy,
    answerCopy: copy.answerCopy,
    audience: copy.audience,
    publishedAt: copy.publishedAt,
  })
}
