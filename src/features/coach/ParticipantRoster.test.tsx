import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { CoachFilters } from "./CoachFilters.tsx"
import { ParticipantRoster } from "./ParticipantRoster.tsx"
import { FILTER_MODEL, PARTICIPANT_ROWS } from "./test-fixtures.ts"

describe("coach participant scan", () => {
  it("reports query and cohort changes when filters are used", async () => {
    // Given
    const user = userEvent.setup()
    const onQueryChange = vi.fn()
    const onCohortChange = vi.fn()
    render(
      <CoachFilters
        model={FILTER_MODEL}
        onCohortChange={onCohortChange}
        onQueryChange={onQueryChange}
      />,
    )

    // When
    await user.type(screen.getByRole("searchbox", { name: "참가자 검색" }), "민정")
    await user.selectOptions(screen.getByRole("combobox", { name: "코호트" }), "cohort:pace-a")

    // Then
    expect(onQueryChange).toHaveBeenCalled()
    expect(onCohortChange).toHaveBeenLastCalledWith("cohort:pace-a")
  })

  it("renders adaptive table and card scans and opens a participant", async () => {
    // Given
    const user = userEvent.setup()
    const onSelectParticipant = vi.fn()
    render(
      <ParticipantRoster
        onSelectParticipant={onSelectParticipant}
        participants={PARTICIPANT_ROWS}
        selectedParticipantId="participant:minjeong"
      />,
    )

    // When
    await user.click(
      screen.getByRole("button", {
        name: "김민정-이름이아주길어도레이아웃이깨지지않는참가자 상세 보기",
      }),
    )

    // Then
    expect(screen.getByRole("table", { hidden: true, name: "참가자 상태" })).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "참가자 상태 카드" })).toBeInTheDocument()
    expect(onSelectParticipant).toHaveBeenCalledWith("participant:minjeong")
  })

  it("shows a stable empty state when no participant matches", () => {
    // Given
    render(<ParticipantRoster onSelectParticipant={vi.fn()} participants={[]} />)

    // When
    const emptyState = screen.getByRole("status")

    // Then
    expect(emptyState).toBeVisible()
  })
})
