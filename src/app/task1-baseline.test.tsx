import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEMO_STORAGE_KEY } from "../demo/index.ts"
import type { PilotGatewayFactory } from "../integrations/supabase/pilot-gateway.ts"
import { App } from "./App.tsx"
import { COACH_HREFS, PARTICIPANT_HREFS, resolveRoute } from "./routes.ts"

describe("Todo 1 route and pilot boundary baseline", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/")
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it.each(PARTICIPANT_HREFS)("resolves the public participant route %s exactly", (href) => {
    // Given
    const pathname = `/run-change-bootcamp${href}`

    // When
    const route = resolveRoute(pathname, "/run-change-bootcamp/")

    // Then
    expect(route).toEqual({ kind: "participant", href })
    expect(resolveRoute(`${pathname}/extra`, "/run-change-bootcamp/")).toEqual({
      kind: "not_found",
    })
  })

  it.each(COACH_HREFS)("resolves the public coach route %s exactly", (href) => {
    // Given
    const pathname = `/run-change-bootcamp${href}`

    // When
    const route = resolveRoute(pathname, "/run-change-bootcamp/")

    // Then
    expect(route).toEqual({ kind: "coach", href })
  })

  it("fails closed before loading the pilot lazy chunk when public config is missing", () => {
    // Given
    const staleDemoState = '{"participant":"participant-19"}'
    window.localStorage.setItem(DEMO_STORAGE_KEY, staleDemoState)
    const pilotGatewayFactory = vi.fn<PilotGatewayFactory>()
    const getItem = vi.spyOn(Storage.prototype, "getItem")

    // When
    render(
      <App
        pilotGatewayFactory={pilotGatewayFactory}
        runtimeEnvironment={{ VITE_APP_RUNTIME: "pilot" }}
      />,
    )

    // Then
    expect(screen.getByRole("alert")).toHaveAttribute("data-block-reason", "missing_public_config")
    expect(getItem).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(DEMO_STORAGE_KEY)).toBe(staleDemoState)
    expect(pilotGatewayFactory).not.toHaveBeenCalled()
  })
})
