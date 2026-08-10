import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { CoachDashboardHandlers, CoachDashboardViewModel } from "./CoachDashboard.tsx"
import { CoachDashboard } from "./CoachDashboard.tsx"
import {
  ASSIGNMENT_DRAFT,
  COHORT_OPTIONS,
  FEEDBACK_ITEMS,
  FILTER_MODEL,
  NOTICE_DRAFT,
  PARTICIPANT_DETAIL,
  PARTICIPANT_ROWS,
  UNDECIDED_TIME_TRIAL,
} from "./test-fixtures.ts"

const HANDLERS = {
  onQueryChange: vi.fn(),
  onCohortChange: vi.fn(),
  onSelectParticipant: vi.fn(),
  onAssignmentDraftChange: vi.fn(),
  onPublishAssignment: vi.fn(),
  onNoticeDraftChange: vi.fn(),
  onPublishNotice: vi.fn(),
  onApproveFeedback: vi.fn(),
  onAutoApproveFeedback: vi.fn(),
  onRejectFeedback: vi.fn(),
  onTimeTrialSessionChange: vi.fn(),
  onTimeTrialProtocolChange: vi.fn(),
  onSaveTimeTrial: vi.fn(),
  onRequestTimeTrialChange: vi.fn(),
  onConfirmTimeTrialChange: vi.fn(),
  onCancelTimeTrialChange: vi.fn(),
} satisfies CoachDashboardHandlers

const MODEL = {
  programName: "RUN CHANGE 1기",
  dateRangeLabel: "2026.08.24 — 10.24",
  summary: {
    totalParticipants: 20,
    missingHomeworkCount: 20,
    staleDataCount: 4,
    painRiskCount: 1,
    pendingFeedbackCount: 2,
  },
  filters: FILTER_MODEL,
  participants: PARTICIPANT_ROWS,
  selectedParticipant: PARTICIPANT_DETAIL,
  cohortOptions: COHORT_OPTIONS,
  assignmentDraft: ASSIGNMENT_DRAFT,
  noticeDraft: NOTICE_DRAFT,
  feedbackItems: FEEDBACK_ITEMS,
  timeTrial: UNDECIDED_TIME_TRIAL,
} satisfies CoachDashboardViewModel

describe("coach dashboard composition", () => {
  it("uses a declared surface token for summary button hover", () => {
    // Given
    const styles = readFileSync(resolve(import.meta.dirname, "coach-dashboard.css"), "utf8")

    // Then
    expect(styles).toContain(".coach-summary__button:hover")
    expect(styles).toContain("background: var(--color-surface-muted)")
    expect(styles).not.toContain("var(--color-bg-hover)")
  })

  it("keeps all-overdue cohort risk visible beside every operating panel", () => {
    // Given
    render(<CoachDashboard handlers={HANDLERS} model={MODEL} />)

    // When
    const dashboard = screen.getByRole("region", { name: "코치 운영 대시보드" })

    // Then
    expect(dashboard).toHaveTextContent("20명")
    expect(screen.getByRole("listitem", { name: "미제출 20" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "RUN CHANGE 1기" })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "발행 도구" })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "승인과 측정 결정" })).toBeInTheDocument()
  })

  it("renders a zero-overdue summary without hiding the metric", () => {
    // Given
    const model = {
      ...MODEL,
      summary: { ...MODEL.summary, missingHomeworkCount: 0 },
    } satisfies CoachDashboardViewModel
    render(<CoachDashboard handlers={HANDLERS} model={model} />)

    // When
    const summary = screen.getByRole("list", { name: "코호트 요약" })

    // Then
    expect(summary).toBeInTheDocument()
    expect(screen.getByRole("listitem", { name: "미제출 0" })).toBeInTheDocument()
  })
})
