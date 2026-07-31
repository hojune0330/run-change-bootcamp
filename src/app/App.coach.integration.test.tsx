import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { App } from "./App.tsx"

async function startCoach() {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole("button", { name: "코치로 시작" }))
  return user
}

describe("coach demo integration", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState({}, "", "/")
  })

  afterEach(cleanup)

  it("moves focus to the operation selected by each coach route", async () => {
    const user = await startCoach()

    await user.click(screen.getByRole("link", { name: "과제" }))
    expect(screen.getByRole("textbox", { name: "과제명" })).toHaveFocus()
    await user.click(screen.getByRole("link", { name: "피드백" }))
    expect(screen.getByRole("button", { name: "김하린 피드백 반려" })).toHaveFocus()
    await user.click(screen.getByRole("link", { name: "공지" }))
    expect(screen.getByRole("textbox", { name: "제목" })).toHaveFocus()
    await user.click(screen.getByRole("link", { name: "20명 현황" }))
    expect(screen.getByRole("searchbox", { name: "참가자 검색" })).toHaveFocus()
  })

  it("publishes an assignment and notice into the participant Today view", async () => {
    // Given
    const user = await startCoach()

    // When
    await user.click(screen.getByRole("button", { name: "과제 발행" }))
    await user.click(screen.getByRole("button", { name: "공지 발행" }))
    await user.click(screen.getByRole("link", { name: "세션 바꾸기" }))
    await user.click(screen.getByRole("button", { name: "참여자로 시작" }))

    // Then
    expect(screen.getByRole("heading", { name: "회복 조깅 30분" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "토요일 집결 안내" })).toBeInTheDocument()
  })

  it("removes approved feedback from the queue and delivers it to My Change", async () => {
    // Given
    const user = await startCoach()

    // When
    await user.click(screen.getByRole("button", { name: "김하린 위험 피드백 검토 후 승인" }))

    // Then
    expect(
      screen.queryByRole("button", { name: "김하린 위험 피드백 검토 후 승인" }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole("link", { name: "세션 바꾸기" }))
    await user.click(screen.getByRole("button", { name: "참여자로 시작" }))
    await user.click(screen.getByRole("link", { name: "내 변화" }))
    expect(screen.getByText("코치가 확인한 피드백이에요.")).toBeInTheDocument()
  })

  it("requires confirmation before revising a time-trial decision and persists the new schedule", async () => {
    // Given
    const user = await startCoach()
    await user.click(screen.getByRole("radio", { name: /1회차/ }))
    await user.click(screen.getByRole("radio", { name: "3K" }))
    await user.click(screen.getByRole("button", { name: "결정 저장" }))

    // When
    await user.click(screen.getByRole("radio", { name: /2회차/ }))
    await user.click(screen.getByRole("radio", { name: "5K" }))
    await user.click(screen.getByRole("button", { name: "결정 변경" }))

    // Then
    expect(screen.getByRole("alert")).toHaveTextContent("기존 결정을 바꾸면")
    await user.click(screen.getByRole("button", { name: "변경 확정" }))
    expect(screen.getByText("오리엔테이션 · 이지런")).toBeInTheDocument()
    expect(screen.getAllByText("5K 첫 기록 측정").length).toBeGreaterThan(0)
    cleanup()
    window.history.replaceState({}, "", "/coach/cohort")
    render(<App />)
    expect(screen.getByRole("radio", { name: /2회차/ })).toBeChecked()
    expect(screen.getByRole("radio", { name: "5K" })).toBeChecked()
  })
})
