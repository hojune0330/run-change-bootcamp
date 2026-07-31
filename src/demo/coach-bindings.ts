import type { CoachDashboardHandlers, TimeTrialDecision } from "../features/coach/index.ts"
import { demoParticipantId } from "./coach-models.ts"
import type { DemoRepository } from "./repository.ts"

export function coachBindings(repository: DemoRepository): CoachDashboardHandlers {
  const approve = (id: Parameters<CoachDashboardHandlers["onApproveFeedback"]>[0]) =>
    repository.decideFeedback(id, "approved")
  const saveDecision = (decision: TimeTrialDecision) => repository.saveTimeTrial(decision)
  return {
    onQueryChange: (query) => repository.setCoachQuery(query),
    onCohortChange: (cohortId) => repository.setCoachCohort(cohortId),
    onSelectParticipant: (id) => {
      const participantId = demoParticipantId(id)
      if (participantId !== null) repository.selectCoachParticipant(participantId)
    },
    onAssignmentDraftChange: (draft) => repository.setAssignmentDraft(draft),
    onPublishAssignment: () => repository.publishAssignment(),
    onNoticeDraftChange: (draft) => repository.setNoticeDraft(draft),
    onPublishNotice: () => repository.publishNotice(),
    onApproveFeedback: approve,
    onAutoApproveFeedback: approve,
    onRejectFeedback: (id) => repository.decideFeedback(id, "rejected"),
    onTimeTrialSessionChange: (session) => repository.setTimeTrialSession(session),
    onTimeTrialProtocolChange: (protocol) => repository.setTimeTrialProtocol(protocol),
    onSaveTimeTrial: saveDecision,
    onRequestTimeTrialChange: (decision) => repository.requestTimeTrialChange(decision),
    onConfirmTimeTrialChange: saveDecision,
    onCancelTimeTrialChange: () => repository.cancelTimeTrialChange(),
  }
}
