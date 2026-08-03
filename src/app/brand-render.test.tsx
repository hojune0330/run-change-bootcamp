import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SECOND_TENANT_BRAND } from "../design/brand-config.ts"
import { AppShell } from "./AppShell.tsx"

describe("PLUS Run brand shell", () => {
  it("renders the exact source logo and tenant labels in the shell", () => {
    // Given
    render(
      <AppShell activeHref="/today" brand={SECOND_TENANT_BRAND} mode="participant">
        <h1>오늘</h1>
      </AppShell>,
    )

    // When
    const logo = screen.getByRole("img", { name: SECOND_TENANT_BRAND.logo.alt })

    // Then
    expect(logo).toHaveAttribute("src", SECOND_TENANT_BRAND.logo.src)
    expect(screen.getByText(SECOND_TENANT_BRAND.tenantName)).toBeInTheDocument()
    expect(screen.getByRole("main")).toHaveAttribute(
      "data-brand-shell-label",
      SECOND_TENANT_BRAND.labels.shell,
    )
  })

  it("supports a compact operational shell without a second page scrollbar", () => {
    // Given
    render(
      <AppShell activeHref="/admin/overview" brand={SECOND_TENANT_BRAND} mode="admin">
        <h1>운영 개요</h1>
      </AppShell>,
    )

    // When
    const shell = document.querySelector<HTMLElement>(".app-shell")
    const main = screen.getByRole("main")

    // Then
    expect(screen.getByRole("navigation", { name: "운영 관리자 주요 메뉴" })).toBeInTheDocument()
    expect(shell).not.toBeNull()
    expect(main).toHaveClass("app-shell__main")
    expect(main).toHaveAttribute("tabindex", "-1")
  })
})
