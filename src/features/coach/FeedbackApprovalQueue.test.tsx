import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { FeedbackApprovalQueue } from "./FeedbackApprovalQueue.tsx"
import { FEEDBACK_ITEMS } from "./test-fixtures.ts"

describe("feedback approval safety", () => {
  it("allows low-risk automation but never auto-approves pain risk", async () => {
    // Given
    const user = userEvent.setup()
    const onAutoApprove = vi.fn()
    const onApprove = vi.fn()
    render(
      <FeedbackApprovalQueue
        items={FEEDBACK_ITEMS}
        onApprove={onApprove}
        onAutoApprove={onAutoApprove}
        onReject={vi.fn()}
      />,
    )

    // When
    await user.click(screen.getByRole("button", { name: "박지훈 저위험 피드백 자동 승인" }))
    await user.click(screen.getByRole("button", { name: "김민정 위험 피드백 검토 후 승인" }))

    // Then
    expect(onAutoApprove).toHaveBeenCalledWith("feedback:recovery-reminder")
    expect(screen.queryByRole("button", { name: "김민정 위험 피드백 자동 승인" })).toBeNull()
    expect(onApprove).toHaveBeenCalledWith("feedback:pain-risk")
  })

  it("shows completion when the approval queue is empty", () => {
    // Given
    render(
      <FeedbackApprovalQueue
        items={[]}
        onApprove={vi.fn()}
        onAutoApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    )

    // When
    const status = screen.getByRole("status")

    // Then
    expect(status).toBeVisible()
  })
})
