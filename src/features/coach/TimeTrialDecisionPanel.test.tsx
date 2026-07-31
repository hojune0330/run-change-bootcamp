import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { TimeTrialDecisionPanelProps } from "./TimeTrialDecisionPanel.tsx"
import { buildTimeTrialConsequences, TimeTrialDecisionPanel } from "./TimeTrialDecisionPanel.tsx"
import { UNDECIDED_TIME_TRIAL } from "./test-fixtures.ts"
import type { TimeTrialViewModel } from "./types.ts"

const HANDLERS = {
  onCancelChange: vi.fn(),
  onConfirmChange: vi.fn(),
  onDraftProtocolChange: vi.fn(),
  onDraftSessionChange: vi.fn(),
  onRequestChangeConfirmation: vi.fn(),
  onSave: vi.fn(),
} satisfies Omit<TimeTrialDecisionPanelProps, "model">

describe("time-trial decision", () => {
  it("starts undecided with no protocol selected", () => {
    // Given
    render(<TimeTrialDecisionPanel {...HANDLERS} model={UNDECIDED_TIME_TRIAL} />)

    // When
    const sessionOne = screen.getByRole("radio", { name: /^1회차/ })
    const protocol = screen.getByRole("radio", { name: "12분" })

    // Then
    expect(sessionOne).not.toBeChecked()
    expect(protocol).not.toBeChecked()
    expect(screen.getByRole("button", { name: "결정 저장" })).toBeDisabled()
  })

  it("previews both sessions and a week-eight retest with the same protocol", () => {
    // Given
    const draft = { session: "session_2", protocol: "5k" } as const

    // When
    const consequences = buildTimeTrialConsequences(draft)

    // Then
    expect(consequences).toEqual({
      sessionOne: "오리엔테이션 · 이지런",
      sessionTwo: "5K 첫 기록 측정",
      weekEight: "8주차 5K 동일 프로토콜 재측정",
    })
  })

  it("requests confirmation instead of saving over a prior decision", async () => {
    // Given
    const user = userEvent.setup()
    const onRequestChangeConfirmation = vi.fn()
    const onSave = vi.fn()
    const model = {
      currentDecision: { kind: "decided", session: "session_1", protocol: "3k" },
      draft: { session: "session_2", protocol: "5k" },
      confirmation: { kind: "idle" },
    } satisfies TimeTrialViewModel
    render(
      <TimeTrialDecisionPanel
        {...HANDLERS}
        model={model}
        onRequestChangeConfirmation={onRequestChangeConfirmation}
        onSave={onSave}
      />,
    )

    // When
    await user.click(screen.getByRole("button", { name: "결정 변경" }))

    // Then
    expect(onRequestChangeConfirmation).toHaveBeenCalledWith({
      kind: "decided",
      session: "session_2",
      protocol: "5k",
    })
    expect(onSave).not.toHaveBeenCalled()
  })

  it("exposes explicit confirm and cancel actions once change confirmation is required", async () => {
    // Given
    const user = userEvent.setup()
    const onConfirmChange = vi.fn()
    const model = {
      currentDecision: { kind: "decided", session: "session_1", protocol: "3k" },
      draft: { session: "session_2", protocol: "5k" },
      confirmation: { kind: "required" },
    } satisfies TimeTrialViewModel
    render(<TimeTrialDecisionPanel {...HANDLERS} model={model} onConfirmChange={onConfirmChange} />)

    // When
    await user.click(screen.getByRole("button", { name: "변경 확정" }))

    // Then
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(onConfirmChange).toHaveBeenCalledWith({
      kind: "decided",
      session: "session_2",
      protocol: "5k",
    })
  })
})
