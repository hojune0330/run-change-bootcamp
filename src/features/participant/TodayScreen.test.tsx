import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { TodayHandlers, TodayViewModel } from "./models.ts"
import { TodayScreen } from "./TodayScreen.tsx"

const TODAY_MODEL = {
  displayName: "김달리기를사랑하는아주긴이름의참여자님",
  dateLabel: "8월 31일 월요일",
  announcement: {
    id: "announcement-week-one",
    title: "첫 지점은 천천히",
    body: "대화가 가능한 속도로 시작해요.",
    publishedLabel: "오늘 오전 8:00",
  },
  assignment: {
    id: "assignment-easy-run",
    title: "편안한 달리기",
    summary: "20분 동안 호흡을 체크해요.",
    dueLabel: "오늘 자정까지",
    durationLabel: "약 20분",
    status: "pending",
  },
} satisfies TodayViewModel

describe("TodayScreen", () => {
  it("completes the assignment once when the completion control is activated twice", async () => {
    // Given
    const user = userEvent.setup()
    const handlers = {
      onCompleteAssignment: vi.fn(async () => ({ kind: "success" }) as const),
    } satisfies TodayHandlers
    render(
      <TodayScreen
        handlers={handlers}
        onRetry={vi.fn()}
        state={{ status: "ready", data: TODAY_MODEL }}
      />,
    )

    // When
    await user.dblClick(screen.getByRole("button", { name: "과제 완료" }))

    // Then
    expect(handlers.onCompleteAssignment).toHaveBeenCalledOnce()
    expect(screen.getByText("오늘 과제를 완료했어요.")).toBeInTheDocument()
  })

  it("shows the announcement and a useful empty state when there is no assignment", () => {
    // Given
    const model = {
      displayName: TODAY_MODEL.displayName,
      dateLabel: TODAY_MODEL.dateLabel,
      announcement: TODAY_MODEL.announcement,
    } satisfies TodayViewModel

    // When
    render(
      <TodayScreen
        handlers={{ onCompleteAssignment: vi.fn() }}
        onRetry={vi.fn()}
        state={{ status: "ready", data: model }}
      />,
    )

    // Then
    expect(screen.getByRole("heading", { name: "첫 지점은 천천히" })).toBeInTheDocument()
    expect(screen.getByText("오늘 할 과제가 없어요.")).toBeInTheDocument()
    expect(screen.getByText(TODAY_MODEL.displayName, { exact: false })).toBeInTheDocument()
  })

  it("moves focus to a retryable error", async () => {
    // Given
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(
      <TodayScreen
        handlers={{ onCompleteAssignment: vi.fn() }}
        onRetry={onRetry}
        state={{ status: "error", message: "오늘 할 일을 불러오지 못했어요." }}
      />,
    )

    expect(screen.getByRole("alert")).toHaveFocus()

    // When
    await user.click(screen.getByRole("button", { name: "다시 시도" }))

    // Then
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
