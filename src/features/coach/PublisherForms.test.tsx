import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { AssignmentPublisher, NoticePublisher } from "./PublisherForms.tsx"
import { ASSIGNMENT_DRAFT, COHORT_OPTIONS, NOTICE_DRAFT } from "./test-fixtures.ts"

describe("coach publishers", () => {
  it("publishes a complete assignment through the explicit handler", async () => {
    // Given
    const user = userEvent.setup()
    const onPublish = vi.fn()
    render(
      <AssignmentPublisher
        cohortOptions={COHORT_OPTIONS}
        draft={ASSIGNMENT_DRAFT}
        onDraftChange={vi.fn()}
        onPublish={onPublish}
      />,
    )

    // When
    await user.click(screen.getByRole("button", { name: "과제 발행" }))

    // Then
    expect(onPublish).toHaveBeenCalledOnce()
  })

  it("publishes a pinned notice and exposes its form controls", async () => {
    // Given
    const user = userEvent.setup()
    const onPublish = vi.fn()
    render(<NoticePublisher draft={NOTICE_DRAFT} onDraftChange={vi.fn()} onPublish={onPublish} />)

    // When
    await user.click(screen.getByRole("button", { name: "공지 발행" }))

    // Then
    expect(screen.getByRole("checkbox", { name: "상단 고정" })).toBeChecked()
    expect(onPublish).toHaveBeenCalledOnce()
  })
})
