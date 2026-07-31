import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { App } from "./App.tsx"

async function startParticipant() {
  const user = userEvent.setup()
  render(<App />)
  await user.selectOptions(screen.getByRole("combobox", { name: "참여자 선택" }), "participant-01")
  await user.click(screen.getByRole("button", { name: "참여자로 시작" }))
  return user
}

describe("participant demo integration", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState({}, "", "/")
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("updates Today, feed, and coach status when homework is completed twice", async () => {
    // Given
    const user = await startParticipant()

    // When
    await user.dblClick(screen.getByRole("button", { name: "과제 완료" }))
    await user.click(screen.getByRole("link", { name: "함께" }))

    // Then
    expect(screen.getByText("편안한 달리기를 완료했어요.")).toBeInTheDocument()
    await user.click(screen.getByRole("link", { name: "세션 바꾸기" }))
    await user.click(screen.getByRole("button", { name: "코치로 시작" }))
    const card = screen.getByRole("button", { name: "김하린 상세 보기" }).closest("article")
    expect(card).not.toBeNull()
    if (card !== null) expect(within(card).getByText("미제출 없음")).toBeInTheDocument()
  })

  it("persists one heart and a comment after a page reload", async () => {
    // Given
    const user = await startParticipant()
    await user.click(screen.getByRole("link", { name: "함께" }))
    const post = screen.getByRole("heading", { name: "이도윤" }).closest("section")
    expect(post).not.toBeNull()
    if (post === null) return

    // When
    await user.dblClick(within(post).getByRole("button", { name: /하트/ }))
    await user.type(within(post).getByRole("textbox", { name: "댓글" }), "함께 달려요")
    await user.click(within(post).getByRole("button", { name: "댓글 등록" }))
    cleanup()
    window.history.replaceState({}, "", "/feed")
    render(<App />)

    // Then
    const persistedPost = screen.getByRole("heading", { name: "이도윤" }).closest("section")
    expect(persistedPost).not.toBeNull()
    if (persistedPost === null) return
    expect(within(persistedPost).getByRole("button", { name: "하트 5" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(within(persistedPost).getByText("함께 달려요")).toBeInTheDocument()
  })

  it("shows a useful error when native sharing and clipboard copying are rejected", async () => {
    // Given
    const user = userEvent.setup()
    render(<App />)
    Object.defineProperty(window.navigator, "share", {
      configurable: true,
      value: vi.fn(async () => Promise.reject(new DOMException("denied", "NotAllowedError"))),
    })
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn(async () => Promise.reject(new DOMException("denied", "NotAllowedError"))),
      },
    })
    await user.click(screen.getByRole("button", { name: "참여자로 시작" }))
    await user.click(screen.getByRole("link", { name: "함께" }))

    // When
    await user.click(screen.getAllByRole("button", { name: "공유" })[0] ?? document.body)

    // Then
    expect(screen.getByRole("alert")).toHaveTextContent("공유와 링크 복사를 사용할 수 없어요.")
  })
})
