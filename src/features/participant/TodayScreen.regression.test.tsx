import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { TodayHandlers, TodayViewModel } from "./models.ts"
import { TodayScreen } from "./TodayScreen.tsx"

const modelWithAssignment = (
  id: "assignment-first" | "assignment-second",
  status: "pending" | "completed",
): TodayViewModel => ({
  displayName: "김러너님",
  dateLabel: "8월 31일 월요일",
  assignment: {
    id,
    title: id === "assignment-first" ? "첫 과제" : "둘째 과제",
    summary: "천천히 시작해요.",
    dueLabel: "오늘 자정까지",
    durationLabel: "약 20분",
    status,
  },
})

describe("TodayScreen regressions", () => {
  it("retires optimistic completion after authoritative assignment versions", async () => {
    // Given
    const user = userEvent.setup()
    const handlers = {
      onCompleteAssignment: vi.fn(async () => ({ kind: "success" }) as const),
    } satisfies TodayHandlers
    const initialModel = modelWithAssignment("assignment-first", "pending")
    const { rerender } = render(
      <TodayScreen
        handlers={handlers}
        onRetry={vi.fn()}
        state={{ status: "ready", data: initialModel }}
      />,
    )

    // When
    await user.click(screen.getByRole("button", { name: "과제 완료" }))

    // Then
    expect(screen.getByRole("button", { name: "완료됨" })).toBeDisabled()

    // When an unrelated parent render reuses the same authoritative snapshot
    rerender(
      <TodayScreen
        handlers={handlers}
        onRetry={vi.fn()}
        state={{ status: "ready", data: initialModel }}
      />,
    )

    // Then the optimistic completion remains visible
    expect(screen.getByRole("button", { name: "완료됨" })).toBeDisabled()

    // When the server acknowledges completion
    rerender(
      <TodayScreen
        handlers={handlers}
        onRetry={vi.fn()}
        state={{ status: "ready", data: modelWithAssignment("assignment-first", "completed") }}
      />,
    )

    // Then
    expect(screen.getByRole("button", { name: "완료됨" })).toBeDisabled()

    // When a newer authoritative version rolls the same assignment back
    rerender(
      <TodayScreen
        handlers={handlers}
        onRetry={vi.fn()}
        state={{ status: "ready", data: modelWithAssignment("assignment-first", "pending") }}
      />,
    )

    // Then the retired optimistic completion cannot reappear
    expect(screen.getByRole("button", { name: "과제 완료" })).toBeEnabled()

    // When a different assignment arrives
    rerender(
      <TodayScreen
        handlers={handlers}
        onRetry={vi.fn()}
        state={{ status: "ready", data: modelWithAssignment("assignment-second", "pending") }}
      />,
    )

    // Then
    expect(screen.getByRole("button", { name: "과제 완료" })).toBeEnabled()
    expect(screen.getByRole("heading", { name: "둘째 과제" })).toBeInTheDocument()
  })

  it("recovers after a rejected completion request", async () => {
    // Given
    const user = userEvent.setup()
    let attempt = 0
    const onCompleteAssignment = vi.fn(async () => {
      attempt += 1
      if (attempt === 1) {
        throw new Error("network unavailable")
      }
      return { kind: "success" } as const
    })
    render(
      <TodayScreen
        handlers={{ onCompleteAssignment }}
        onRetry={vi.fn()}
        state={{ status: "ready", data: modelWithAssignment("assignment-first", "pending") }}
      />,
    )

    // When
    await user.click(screen.getByRole("button", { name: "과제 완료" }))

    // Then
    const error = await screen.findByRole("alert")
    expect(error).toHaveTextContent("과제를 완료하지 못했어요. 다시 시도해 주세요.")
    expect(error).toHaveFocus()
    expect(screen.getByRole("button", { name: "과제 완료" })).toBeEnabled()

    // When
    await user.click(screen.getByRole("button", { name: "과제 완료" }))

    // Then
    expect(onCompleteAssignment).toHaveBeenCalledTimes(2)
    expect(screen.getByText("오늘 과제를 완료했어요.")).toBeInTheDocument()
  })
})
