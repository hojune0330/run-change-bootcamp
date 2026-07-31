import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AppShell } from "./AppShell"

describe("AppShell", () => {
  it("exposes landmarks, a skip link, and the current participant route", () => {
    // Given
    render(
      <AppShell activeHref="/today" mode="participant">
        <h1>오늘의 러닝과 건강 기록을 차분하게 확인하세요</h1>
      </AppShell>,
    )

    // When
    const currentRoute = screen.getByRole("link", { name: "오늘" })

    // Then
    expect(screen.getByRole("link", { name: "본문으로 건너뛰기" })).toHaveAttribute(
      "href",
      "#main-content",
    )
    expect(screen.getByRole("navigation", { name: "참여자 주요 메뉴" })).toBeInTheDocument()
    expect(screen.getByRole("main", { name: "RUN CHANGE 콘텐츠" })).toBeInTheDocument()
    expect(currentRoute).toHaveAttribute("aria-current", "page")
  })

  it("uses coach navigation labels when the shell mode is coach", () => {
    // Given
    render(
      <AppShell activeHref="/coach/cohort" mode="coach">
        <h1>코호트 운영</h1>
      </AppShell>,
    )

    // When
    const navigation = screen.getByRole("navigation", { name: "코치 주요 메뉴" })

    // Then
    expect(navigation).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "20명 현황" })).toHaveAttribute("aria-current", "page")
  })
})
