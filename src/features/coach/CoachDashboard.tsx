import { CoachFilters } from "./CoachFilters.tsx"
import { FeedbackApprovalQueue } from "./FeedbackApprovalQueue.tsx"
import { ParticipantDetail } from "./ParticipantDetail.tsx"
import { ParticipantRoster } from "./ParticipantRoster.tsx"
import { AssignmentPublisher, NoticePublisher } from "./PublisherForms.tsx"
import { TimeTrialDecisionPanel } from "./TimeTrialDecisionPanel.tsx"
import type {
  AssignmentDraft,
  CoachFilterViewModel,
  CoachSummaryViewModel,
  CohortId,
  CohortOption,
  FeedbackId,
  NoticeDraft,
  ParticipantDetailViewModel,
  ParticipantId,
  ParticipantStatusViewModel,
  PendingFeedback,
  TimeTrialDecision,
  TimeTrialProtocol,
  TimeTrialSession,
  TimeTrialViewModel,
} from "./types.ts"
import "./coach-dashboard.css"

export type CoachDashboardViewModel = {
  readonly programName: string
  readonly dateRangeLabel: string
  readonly summary: CoachSummaryViewModel
  readonly filters: CoachFilterViewModel
  readonly participants: readonly ParticipantStatusViewModel[]
  readonly selectedParticipant?: ParticipantDetailViewModel
  readonly cohortOptions: readonly CohortOption[]
  readonly assignmentDraft: AssignmentDraft
  readonly assignmentPublishing?: boolean
  readonly noticeDraft: NoticeDraft
  readonly noticePublishing?: boolean
  readonly feedbackItems: readonly PendingFeedback[]
  readonly timeTrial: TimeTrialViewModel
}

export type CoachDashboardHandlers = {
  readonly onQueryChange: (query: string) => void
  readonly onCohortChange: (cohortId: CohortId | "all") => void
  readonly onSelectParticipant: (participantId: ParticipantId) => void
  readonly onAssignmentDraftChange: (draft: AssignmentDraft) => void
  readonly onPublishAssignment: () => void
  readonly onNoticeDraftChange: (draft: NoticeDraft) => void
  readonly onPublishNotice: () => void
  readonly onApproveFeedback: (feedbackId: FeedbackId) => void
  readonly onAutoApproveFeedback: (feedbackId: FeedbackId) => void
  readonly onRejectFeedback: (feedbackId: FeedbackId) => void
  readonly onTimeTrialSessionChange: (session: TimeTrialSession) => void
  readonly onTimeTrialProtocolChange: (protocol: TimeTrialProtocol) => void
  readonly onSaveTimeTrial: (decision: TimeTrialDecision) => void
  readonly onRequestTimeTrialChange: (decision: TimeTrialDecision) => void
  readonly onConfirmTimeTrialChange: (decision: TimeTrialDecision) => void
  readonly onCancelTimeTrialChange: () => void
}

export type CoachDashboardProps = {
  readonly handlers: CoachDashboardHandlers
  readonly model: CoachDashboardViewModel
}

const SUMMARY_ITEMS = [
  {
    key: "participants",
    label: "참가자",
    field: "totalParticipants",
    suffix: "명",
    hint: "전체 코호트",
  },
  {
    key: "homework",
    label: "미제출",
    field: "missingHomeworkCount",
    suffix: "",
    hint: "과제 완료 안 된 분",
  },
  {
    key: "stale",
    label: "데이터 지연",
    field: "staleDataCount",
    suffix: "",
    hint: "기록 없이 지난 분",
  },
  { key: "risk", label: "통증·위험", field: "painRiskCount", suffix: "", hint: "코치 확인 필요" },
  {
    key: "feedback",
    label: "피드백 대기",
    field: "pendingFeedbackCount",
    suffix: "",
    hint: "승인 대기",
  },
] as const

export function CoachDashboard({ handlers, model }: CoachDashboardProps) {
  const focusRoster = () => {
    const roster = document.querySelector<HTMLElement>(".coach-roster")
    roster?.scrollIntoView({ block: "start" })
    const search = document.querySelector<HTMLInputElement>('[role="search"] input[type="search"]')
    search?.focus({ preventScroll: true })
  }

  return (
    <section aria-label="코치 운영 대시보드" className="coach-dashboard">
      <header className="coach-dashboard__header">
        <div>
          <p>코치 데스크 · {model.dateRangeLabel}</p>
          <h1>{model.programName}</h1>
          <span>20명 코호트의 과제, 안전 신호, 승인 대기를 한곳에서 확인합니다.</span>
        </div>
      </header>

      <ul aria-label="코호트 요약" className="coach-summary">
        {SUMMARY_ITEMS.map((item) => (
          <li
            aria-label={`${item.label} ${model.summary[item.field]}${item.suffix}`}
            key={item.key}
          >
            <button
              aria-label={`${item.label} ${model.summary[item.field]}${item.suffix} 현황 보기`}
              className="coach-summary__button"
              onClick={focusRoster}
              type="button"
            >
              <span>{item.label}</span>
              <strong>
                {model.summary[item.field]}
                {item.suffix}
              </strong>
              <small>{item.hint}</small>
            </button>
          </li>
        ))}
      </ul>

      <CoachFilters
        model={model.filters}
        onCohortChange={handlers.onCohortChange}
        onQueryChange={handlers.onQueryChange}
      />

      <div className="coach-dashboard__participants">
        <ParticipantRoster
          onSelectParticipant={handlers.onSelectParticipant}
          participants={model.participants}
          {...(model.selectedParticipant === undefined
            ? {}
            : { selectedParticipantId: model.selectedParticipant.id })}
        />
        {model.selectedParticipant === undefined ? (
          <ParticipantDetail />
        ) : (
          <ParticipantDetail participant={model.selectedParticipant} />
        )}
      </div>

      <section aria-labelledby="publisher-tools-title" className="coach-dashboard__section">
        <div className="coach-dashboard__section-heading">
          <p>발행</p>
          <h2 id="publisher-tools-title">발행 도구</h2>
        </div>
        <div className="coach-dashboard__publishers">
          <AssignmentPublisher
            cohortOptions={model.cohortOptions}
            draft={model.assignmentDraft}
            onDraftChange={handlers.onAssignmentDraftChange}
            onPublish={handlers.onPublishAssignment}
            publishing={model.assignmentPublishing ?? false}
          />
          <NoticePublisher
            draft={model.noticeDraft}
            onDraftChange={handlers.onNoticeDraftChange}
            onPublish={handlers.onPublishNotice}
            publishing={model.noticePublishing ?? false}
          />
        </div>
      </section>

      <section aria-labelledby="approval-tools-title" className="coach-dashboard__section">
        <div className="coach-dashboard__section-heading">
          <p>검토</p>
          <h2 id="approval-tools-title">승인과 측정 결정</h2>
        </div>
        <div className="coach-dashboard__review">
          <FeedbackApprovalQueue
            items={model.feedbackItems}
            onApprove={handlers.onApproveFeedback}
            onAutoApprove={handlers.onAutoApproveFeedback}
            onReject={handlers.onRejectFeedback}
          />
          <TimeTrialDecisionPanel
            model={model.timeTrial}
            onCancelChange={handlers.onCancelTimeTrialChange}
            onConfirmChange={handlers.onConfirmTimeTrialChange}
            onDraftProtocolChange={handlers.onTimeTrialProtocolChange}
            onDraftSessionChange={handlers.onTimeTrialSessionChange}
            onRequestChangeConfirmation={handlers.onRequestTimeTrialChange}
            onSave={handlers.onSaveTimeTrial}
          />
        </div>
      </section>
    </section>
  )
}
