import type { z } from "zod"
import {
  type PrivateQuestionAnswer,
  PrivateQuestionAnswerSchema,
  type PrivateQuestionThread,
  PrivateQuestionThreadSchema,
  plusDays,
  type RoutingStatusSchema,
} from "./privacy-audiences-core"
import { PrivacyTransitionError } from "./privacy-audiences-errors"
import type { IsoDateTimeSchema } from "./values"

type QuestionActionInput = {
  readonly thread: PrivateQuestionThread
  readonly actorProfileId: string
  readonly at: z.infer<typeof IsoDateTimeSchema>
}
function ownerAction(input: QuestionActionInput): PrivateQuestionThread {
  if (input.thread.participantProfileId !== input.actorProfileId)
    throw new PrivacyTransitionError("forbidden")
  return input.thread
}
export function editPrivateQuestion(
  input: QuestionActionInput & { readonly body: string },
): PrivateQuestionThread {
  const thread = ownerAction(input)
  if (thread.status !== "open") throw new PrivacyTransitionError("invalid_transition")
  return PrivateQuestionThreadSchema.parse({
    ...thread,
    questionBody: input.body,
    updatedAt: input.at,
  })
}
export function closePrivateQuestion(input: QuestionActionInput): PrivateQuestionThread {
  const thread = ownerAction(input)
  if (thread.status !== "open") throw new PrivacyTransitionError("invalid_transition")
  return PrivateQuestionThreadSchema.parse({
    ...thread,
    status: "closed",
    closedAt: input.at,
    closedByProfileId: input.actorProfileId,
    updatedAt: input.at,
  })
}
export function archivePrivateQuestion(input: QuestionActionInput): PrivateQuestionThread {
  const thread = ownerAction(input)
  if (input.thread.status !== "open" && input.thread.status !== "closed")
    throw new PrivacyTransitionError("invalid_transition")
  return PrivateQuestionThreadSchema.parse({
    ...thread,
    status: "archived",
    archivedAt: input.at,
    archivedByProfileId: input.actorProfileId,
    updatedAt: input.at,
  })
}
export function deletePrivateQuestion(input: QuestionActionInput): PrivateQuestionThread {
  const thread = ownerAction(input)
  if (thread.status === "archived" || thread.status === "deleted")
    throw new PrivacyTransitionError("invalid_transition")
  return PrivateQuestionThreadSchema.parse({
    ...thread,
    status: "deleted",
    deletedAt: input.at,
    deletedByProfileId: input.actorProfileId,
    purgeAfter: plusDays(input.at, 30),
    updatedAt: input.at,
  })
}
type AnswerActionInput = {
  readonly answer: PrivateQuestionAnswer
  readonly thread: PrivateQuestionThread
  readonly actorProfileId: string
  readonly namedCoachProfileId: string
  readonly at: z.infer<typeof IsoDateTimeSchema>
}
function answerOwnerAction(input: AnswerActionInput): PrivateQuestionAnswer {
  if (
    input.answer.authorProfileId !== input.actorProfileId ||
    input.actorProfileId !== input.namedCoachProfileId ||
    input.answer.threadId !== input.thread.id ||
    input.answer.programId !== input.thread.programId ||
    input.thread.status !== "open"
  )
    throw new PrivacyTransitionError("forbidden")
  return input.answer
}
export function editPrivateAnswer(
  input: AnswerActionInput & { readonly body: string },
): PrivateQuestionAnswer {
  const answer = answerOwnerAction(input)
  if (answer.status !== "active") throw new PrivacyTransitionError("invalid_transition")
  return PrivateQuestionAnswerSchema.parse({
    ...answer,
    answerBody: input.body,
    updatedAt: input.at,
  })
}
export function deletePrivateAnswer(input: AnswerActionInput): PrivateQuestionAnswer {
  const answer = answerOwnerAction(input)
  if (answer.status !== "active") throw new PrivacyTransitionError("invalid_transition")
  return PrivateQuestionAnswerSchema.parse({
    ...answer,
    status: "deleted",
    deletedAt: input.at,
    deletedByProfileId: input.actorProfileId,
    purgeAfter: plusDays(input.at, 30),
    updatedAt: input.at,
  })
}
export function routePrivateQuestion(
  input: QuestionActionInput & {
    readonly routingStatus: z.infer<typeof RoutingStatusSchema>
    readonly namedCoachProfileId: string
    readonly activeAnswerCount?: number
    readonly hasActiveAnswer?: boolean
  },
): PrivateQuestionThread {
  if (input.thread.status !== "open") throw new PrivacyTransitionError("invalid_transition")
  if (input.actorProfileId !== input.namedCoachProfileId)
    throw new PrivacyTransitionError("forbidden")
  const activeAnswerCount =
    input.activeAnswerCount ??
    (input.hasActiveAnswer === undefined ? undefined : input.hasActiveAnswer ? 1 : 0)
  if (
    input.activeAnswerCount !== undefined &&
    input.hasActiveAnswer !== undefined &&
    input.activeAnswerCount > 0 !== input.hasActiveAnswer
  )
    throw new PrivacyTransitionError("invalid_transition")
  if (
    activeAnswerCount !== undefined &&
    (!Number.isInteger(activeAnswerCount) || activeAnswerCount < 0)
  )
    throw new PrivacyTransitionError("invalid_transition")
  if (input.routingStatus !== "needs_followup" && activeAnswerCount === undefined)
    throw new PrivacyTransitionError("invalid_transition")
  if (input.routingStatus === "answered" && activeAnswerCount === 0)
    throw new PrivacyTransitionError("invalid_transition")
  if (input.routingStatus === "unanswered" && activeAnswerCount !== 0)
    throw new PrivacyTransitionError("invalid_transition")
  return PrivateQuestionThreadSchema.parse({
    ...input.thread,
    routingStatus: input.routingStatus,
    updatedAt: input.at,
  })
}
