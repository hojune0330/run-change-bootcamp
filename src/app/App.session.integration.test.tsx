import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { App } from "./App.tsx"

const DEMO_STORAGE_KEY = "run-change-bootcamp:demo:v1"

describe("demo session boundary", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState({}, "", "/")
  })

  afterEach(cleanup)

  it("explains production magic-link setup and offers participant and coach sessions", () => {
    // Given
    render(<App />)

    // When
    const chooser = screen.getByRole("region", { name: "데모 세션 선택" })

    // Then
    expect(chooser).toBeInTheDocument()
    expect(screen.getByText("이메일 매직 링크를 연결하세요.")).toBeVisible()
    expect(screen.getByRole("combobox", { name: "참여자 선택" })).toHaveLength(20)
    expect(screen.getByRole("button", { name: "참여자로 시작" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "코치로 시작" })).toBeEnabled()
  })

  it("recovers safely from corrupt local storage", () => {
    // Given
    window.localStorage.setItem(DEMO_STORAGE_KEY, "{corrupt")
    window.history.replaceState({}, "", "/today")

    // When
    render(<App />)

    // Then
    expect(screen.getByRole("region", { name: "데모 세션 선택" })).toBeInTheDocument()
    expect(window.localStorage.getItem(DEMO_STORAGE_KEY)).toMatch(/^\{"version":1,/)
  })

  it("restores the selected participant session after reload", async () => {
    // Given
    const user = userEvent.setup()
    render(<App />)
    await user.selectOptions(
      screen.getByRole("combobox", { name: "참여자 선택" }),
      "participant-03",
    )
    await user.click(screen.getByRole("button", { name: "참여자로 시작" }))

    // When
    cleanup()
    window.history.replaceState({}, "", "/today")
    render(<App />)

    // Then
    expect(screen.getByText("박서아, 하나만 완료해요.")).toBeInTheDocument()
  })

  it("keeps private health values out of the coach view before consent", async () => {
    // Given
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: "코치로 시작" }))

    // When
    await user.click(screen.getByRole("button", { name: "김하린 상세 보기" }))

    // Then
    expect(screen.queryByText("55 bpm")).not.toBeInTheDocument()
    expect(screen.getByText("동의 없음")).toBeInTheDocument()
  })
})
