import { buildNineWeekSchedule, type TimeTrialProtocol as DomainProtocol } from "../domain/index.ts"
import type {
  AssignmentDraft,
  CohortId,
  FeedbackId,
  NoticeDraft,
  TimeTrialDecision,
  TimeTrialProtocol,
  TimeTrialSession,
} from "../features/coach/index.ts"
import type {
  ActionResult,
  AssignmentId,
  ConsentChangeResult,
  DraftId,
  DraftResult,
  ManualMetricInput,
  PostId,
} from "../features/participant/models.ts"
import {
  publishAssignment,
  publishNotice,
  resolveFeedback,
  saveTimeTrial,
  selectParticipant,
  updateAssignmentDraft,
  updateNoticeDraft,
  updateTimeTrialProtocol,
  updateTimeTrialSession,
} from "./coach-actions.ts"
import { createFileDraft, createScreenshotDraft } from "./drafts.ts"
import {
  addComment,
  changeConsent,
  completeAssignment,
  saveDraft,
  saveManualMetric,
  setHeart,
  storeDraft,
} from "./participant-actions.ts"
import {
  type DemoParticipantId,
  DemoParticipantIdSchema,
  type DemoState,
  DemoStateSchema,
} from "./state.ts"
import { type DemoStorage, DemoStorageAdapter } from "./storage.ts"

type Listener = () => void

function domainProtocol(protocol: TimeTrialProtocol): DomainProtocol {
  switch (protocol) {
    case "12_minute":
      return "12-minute"
    case "3k":
      return "3k"
    case "5k":
      return "5k"
  }
}

export class DemoRepository {
  private state: DemoState
  private readonly listeners = new Set<Listener>()

  constructor(private readonly adapter: DemoStorageAdapter) {
    this.state = adapter.load()
  }

  readonly getSnapshot = (): DemoState => this.state

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  chooseParticipant(participantId: DemoParticipantId): void {
    const parsed = DemoParticipantIdSchema.parse(participantId)
    this.commit({ ...this.state, session: { role: "participant", participantId: parsed } })
  }

  chooseCoach(): void {
    this.commit({ ...this.state, session: { role: "coach" } })
  }

  clearSession(): void {
    this.commit({ ...this.state, session: null })
  }

  reset(): void {
    this.state = this.adapter.reset()
    this.emit()
  }

  complete(participantId: DemoParticipantId, assignmentId: AssignmentId): ActionResult {
    if (!this.state.assignments.some((item) => item.id === assignmentId)) {
      return { kind: "error", message: "과제를 찾지 못했어요." }
    }
    this.commit(completeAssignment(this.state, { participantId, assignmentId }))
    return { kind: "success" }
  }

  heart(participantId: DemoParticipantId, postId: PostId, hearted: boolean): ActionResult {
    if (!this.state.posts.some((item) => item.id === postId)) {
      return { kind: "error", message: "기록을 찾지 못했어요." }
    }
    this.commit(setHeart(this.state, { participantId, postId, hearted }))
    return { kind: "success" }
  }

  comment(participantId: DemoParticipantId, postId: PostId, body: string): ActionResult {
    const next = addComment(this.state, { participantId, postId, body })
    if (next === this.state) return { kind: "error", message: "댓글 내용을 확인해 주세요." }
    this.commit(next)
    return { kind: "success" }
  }

  saveManual(participantId: DemoParticipantId, input: ManualMetricInput): ActionResult {
    this.commit(saveManualMetric(this.state, participantId, input))
    return { kind: "success" }
  }

  async importFile(participantId: DemoParticipantId, file: File): Promise<DraftResult> {
    const creation = await createFileDraft(participantId, file)
    if (creation.kind === "error") return creation.result
    this.commit(storeDraft(this.state, creation.draft))
    return { kind: "success", draft: creation.view }
  }

  async uploadScreenshot(participantId: DemoParticipantId, file: File): Promise<DraftResult> {
    const creation = await createScreenshotDraft(participantId, file)
    if (creation.kind === "error") return creation.result
    this.commit(storeDraft(this.state, creation.draft))
    return { kind: "success", draft: creation.view }
  }

  confirmDraft(participantId: DemoParticipantId, id: DraftId): ActionResult {
    const next = saveDraft(this.state, participantId, id)
    if (next === this.state) return { kind: "error", message: "초안을 찾지 못했어요." }
    this.commit(next)
    return { kind: "success" }
  }

  consent(participantId: DemoParticipantId, enabled: boolean): ConsentChangeResult {
    const change = changeConsent(this.state, participantId, enabled)
    if (change.state !== this.state) this.commit(change.state)
    return change.result
  }

  setCoachQuery(query: string): void {
    this.commit({ ...this.state, coachQuery: query })
  }

  setCoachCohort(cohortId: CohortId | "all"): void {
    this.commit({ ...this.state, coachCohortId: cohortId })
  }

  selectCoachParticipant(participantId: DemoParticipantId): void {
    this.commit(selectParticipant(this.state, participantId))
  }

  setAssignmentDraft(draft: AssignmentDraft): void {
    this.commit(updateAssignmentDraft(this.state, draft))
  }

  publishAssignment(): void {
    this.commit(publishAssignment(this.state))
  }

  setNoticeDraft(draft: NoticeDraft): void {
    this.commit(updateNoticeDraft(this.state, draft))
  }

  publishNotice(): void {
    this.commit(publishNotice(this.state))
  }

  decideFeedback(feedbackId: FeedbackId, decision: "approved" | "rejected"): void {
    this.commit(resolveFeedback(this.state, feedbackId, decision))
  }

  setTimeTrialSession(session: TimeTrialSession): void {
    this.commit(updateTimeTrialSession(this.state, session))
  }

  setTimeTrialProtocol(protocol: TimeTrialProtocol): void {
    this.commit(updateTimeTrialProtocol(this.state, protocol))
  }

  requestTimeTrialChange(decision: TimeTrialDecision): void {
    const next = saveTimeTrial(this.state, decision)
    this.commit({
      ...next,
      timeTrialDecision: this.state.timeTrialDecision,
      timeTrialConfirmation: "required",
    })
  }

  cancelTimeTrialChange(): void {
    this.commit({ ...this.state, timeTrialConfirmation: "idle" })
  }

  saveTimeTrial(decision: TimeTrialDecision): void {
    this.commit(saveTimeTrial(this.state, decision))
  }

  schedule() {
    const decision = this.state.timeTrialDecision
    return buildNineWeekSchedule({
      startsOn: "2026-08-24",
      decision:
        decision.kind === "undecided"
          ? { status: "undecided" }
          : {
              status: "decided",
              session: decision.session === "session_1" ? 1 : 2,
              protocol: domainProtocol(decision.protocol),
              decidedAt: "2026-08-31T09:00:00+09:00",
              decidedBy: "membership-coach",
            },
    })
  }

  private commit(next: DemoState): void {
    this.state = DemoStateSchema.parse(next)
    this.adapter.save(this.state)
    this.emit()
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

export function createDemoRepository(storage: DemoStorage): DemoRepository {
  return new DemoRepository(new DemoStorageAdapter(storage))
}
