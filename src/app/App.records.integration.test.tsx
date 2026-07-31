import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { App } from "./App.tsx"

async function startOnRecord() {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole("button", { name: "참여자로 시작" }))
  await user.click(screen.getByRole("link", { name: "기록" }))
  return user
}

describe("record and privacy demo integration", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState({}, "", "/")
  })

  afterEach(cleanup)

  it("shows a manually saved metric in My Change", async () => {
    // Given
    const user = await startOnRecord()
    await user.selectOptions(screen.getByRole("combobox", { name: "측정 항목" }), "distance_km")
    await user.type(screen.getByRole("spinbutton", { name: "측정값" }), "5.2")

    // When
    await user.click(screen.getByRole("button", { name: "직접 기록 저장" }))
    await user.click(screen.getByRole("link", { name: "내 변화" }))

    // Then
    expect(screen.getByText("5.2 km")).toBeInTheDocument()
  })

  it("keeps an imported CSV as a review draft until it is saved", async () => {
    // Given
    const user = await startOnRecord()
    await user.click(screen.getByRole("button", { name: "파일 가져오기" }))
    const file = new File(
      ["timestamp,metric,value,unit\n2026-08-31T07:00:00+09:00,distance,5000,m"],
      "morning-run.csv",
      { type: "text/csv" },
    )
    await user.upload(screen.getByLabelText("활동 파일"), file)

    // When
    await user.click(screen.getByRole("button", { name: "초안 만들기" }))

    // Then
    expect(screen.getByText("기록에 아직 반영되지 않았어요.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "검토 완료 · 초안 보관" }))
    await user.click(screen.getByRole("link", { name: "내 변화" }))
    expect(screen.getByText("5.0 km")).toBeInTheDocument()
  })

  it("keeps a screenshot pending without inventing a metric when extraction is disconnected", async () => {
    // Given
    const user = await startOnRecord()
    await user.click(screen.getByRole("button", { name: "스크린샷 올리기" }))
    const screenshot = new File(["image"], "run-summary.png", { type: "image/png" })
    await user.upload(screen.getByLabelText("운동 스크린샷"), screenshot)

    // When
    await user.click(screen.getByRole("button", { name: "이미지에서 초안 만들기" }))

    // Then
    expect(screen.getByText("분석 대기 · 추출 연결이 필요합니다.")).toBeInTheDocument()
    expect(screen.queryByText("5.0 km")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "검토 완료 · 초안 보관" }))
    await user.click(screen.getByRole("link", { name: "내 변화" }))
    expect(screen.queryByText("스크린샷 초안")).not.toBeInTheDocument()
  })

  it("reveals a consented health item to the coach and hides it again after revocation", async () => {
    // Given
    const user = await startOnRecord()
    await user.click(screen.getByRole("link", { name: "내 변화" }))
    const consent = screen.getByRole("switch", { name: "안정 시 심박수 · 코치" })
    expect(consent).toHaveAttribute("aria-checked", "false")

    // When
    await user.click(consent)
    await user.click(screen.getByRole("link", { name: "세션 바꾸기" }))
    await user.click(screen.getByRole("button", { name: "코치로 시작" }))
    await user.click(screen.getByRole("button", { name: "김하린 상세 보기" }))

    // Then
    expect(screen.getByText("55 bpm")).toBeInTheDocument()
    await user.click(screen.getByRole("link", { name: "세션 바꾸기" }))
    await user.click(screen.getByRole("button", { name: "참여자로 시작" }))
    await user.click(screen.getByRole("link", { name: "내 변화" }))
    await user.click(screen.getByRole("switch", { name: "안정 시 심박수 · 코치" }))
    await user.click(screen.getByRole("link", { name: "세션 바꾸기" }))
    await user.click(screen.getByRole("button", { name: "코치로 시작" }))
    await user.click(screen.getByRole("button", { name: "김하린 상세 보기" }))
    expect(screen.queryByText("55 bpm")).not.toBeInTheDocument()
    expect(screen.getByText("공유 철회")).toBeInTheDocument()
  })
})
