import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createDemoRepository } from "../demo/repository.ts"
import { createInitialDemoState } from "../demo/seed.ts"
import { AdminApp } from "./AdminApp.tsx"
import { ADMIN_HREFS, type AdminHref, resolveRoute } from "./routes.ts"

const ADMIN_SCREEN_CASES = [
  {
    href: "/admin/overview",
    navigationLabel: "운영 개요",
    screenLabel: "관리자 운영 대시보드",
  },
  { href: "/admin/members", navigationLabel: "멤버", screenLabel: "관리자 멤버 명부" },
  { href: "/admin/schedule", navigationLabel: "일정", screenLabel: "관리자 프로그램 일정" },
  {
    href: "/admin/activity",
    navigationLabel: "활동 로그",
    screenLabel: "관리자 활동 로그",
  },
  { href: "/admin/reports", navigationLabel: "보고", screenLabel: "관리자 운영 보고" },
  { href: "/admin/settings", navigationLabel: "설정", screenLabel: "관리자 프로그램 설정" },
] as const satisfies readonly {
  readonly href: AdminHref
  readonly navigationLabel: string
  readonly screenLabel: string
}[]

describe("preview admin route ownership", () => {
  afterEach(cleanup)

  it("keeps exactly six unique admin routes at the public boundary", () => {
    // Given
    const uniqueRoutes = new Set(ADMIN_HREFS)

    // When
    const resolved = ADMIN_HREFS.map((href) =>
      resolveRoute(`/run-change-bootcamp${href}`, "/run-change-bootcamp/"),
    )

    // Then
    expect(ADMIN_HREFS).toHaveLength(6)
    expect(uniqueRoutes.size).toBe(6)
    expect(resolved).toEqual(ADMIN_HREFS.map((href) => ({ kind: "admin", href })))
  })

  it.each(ADMIN_SCREEN_CASES)(
    "renders a distinct $screenLabel screen with active navigation at $href",
    ({ href, navigationLabel, screenLabel }) => {
      // Given
      const repository = createDemoRepository(window.localStorage)

      // When
      render(
        <AdminApp
          href={href}
          onNavigate={vi.fn()}
          repository={repository}
          state={createInitialDemoState()}
        />,
      )

      // Then
      expect(screen.getByRole("region", { name: screenLabel })).toBeVisible()
      expect(screen.getByRole("link", { name: navigationLabel })).toHaveAttribute(
        "aria-current",
        "page",
      )
    },
  )
})
