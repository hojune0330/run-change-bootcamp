import "@fontsource-variable/jetbrains-mono/wght.css"
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css"
import { createRoot } from "react-dom/client"
import { COLOR_TOKEN_ENTRIES } from "../../design/color-tokens.ts"
import "../../design/tokens.css"
import "../../design/global.css"
import { CoachDashboard, type CoachDashboardHandlers } from "./CoachDashboard.tsx"
import {
  ASSIGNMENT_DRAFT,
  COHORT_OPTIONS,
  FEEDBACK_ITEMS,
  FILTER_MODEL,
  NOTICE_DRAFT,
  PARTICIPANT_DETAIL,
  PARTICIPANT_ROWS,
} from "./test-fixtures.ts"
import type { ParticipantId, ParticipantStatusViewModel } from "./types.ts"
import "./coach-preview-harness.css"

for (const [property, value] of COLOR_TOKEN_ENTRIES) {
  document.documentElement.style.setProperty(property, value)
}

function previewParticipantId(groupIndex: number, participantIndex: number): ParticipantId {
  return `participant:preview-${groupIndex}-${participantIndex}`
}

const participants: readonly ParticipantStatusViewModel[] = Array.from({ length: 10 }).flatMap(
  (_, groupIndex) =>
    PARTICIPANT_ROWS.map((participant, participantIndex) => ({
      ...participant,
      id: previewParticipantId(groupIndex, participantIndex),
      name: groupIndex === 0 ? participant.name : `${participant.name} ${groupIndex + 1}`,
    })),
)

const handlers = {
  onQueryChange: () => undefined,
  onCohortChange: () => undefined,
  onSelectParticipant: () => undefined,
  onAssignmentDraftChange: () => undefined,
  onPublishAssignment: () => undefined,
  onNoticeDraftChange: () => undefined,
  onPublishNotice: () => undefined,
  onApproveFeedback: () => undefined,
  onAutoApproveFeedback: () => undefined,
  onRejectFeedback: () => undefined,
  onTimeTrialSessionChange: () => undefined,
  onTimeTrialProtocolChange: () => undefined,
  onSaveTimeTrial: () => undefined,
  onRequestTimeTrialChange: () => undefined,
  onConfirmTimeTrialChange: () => undefined,
  onCancelTimeTrialChange: () => undefined,
} satisfies CoachDashboardHandlers

const rootElement = document.getElementById("coach-preview-root")

if (rootElement === null) {
  throw new TypeError("코치 검증 루트를 찾을 수 없습니다.")
}

createRoot(rootElement).render(
  <div className="coach-preview-harness">
    <CoachDashboard
      handlers={handlers}
      model={{
        programName: "RUN CHANGE 1기",
        dateRangeLabel: "2026.08.24 — 10.24",
        summary: {
          totalParticipants: 20,
          missingHomeworkCount: 20,
          staleDataCount: 10,
          painRiskCount: 10,
          pendingFeedbackCount: 10,
        },
        filters: { ...FILTER_MODEL, resultCount: 20 },
        participants,
        selectedParticipant: PARTICIPANT_DETAIL,
        cohortOptions: COHORT_OPTIONS,
        assignmentDraft: ASSIGNMENT_DRAFT,
        noticeDraft: NOTICE_DRAFT,
        feedbackItems: FEEDBACK_ITEMS,
        timeTrial: {
          currentDecision: { kind: "undecided" },
          draft: { session: "session_2", protocol: "5k" },
          confirmation: { kind: "idle" },
        },
      }}
    />
  </div>,
)
