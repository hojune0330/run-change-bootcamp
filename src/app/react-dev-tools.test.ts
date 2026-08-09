import { describe, expect, it } from "vitest"
import { shouldLoadReactDevTools } from "./react-dev-tools.ts"

describe("React development tooling boundary", () => {
  it("loads instrumentation only when a developer explicitly opts in during development", () => {
    // Given
    const environment = { DEV: true, VITE_ENABLE_DEV_TOOLS: "1" }

    // When
    const enabled = shouldLoadReactDevTools(environment)

    // Then
    expect(enabled).toBe(true)
  })

  it.each([
    ["development without opt-in", { DEV: true }],
    ["production with opt-in", { DEV: false, VITE_ENABLE_DEV_TOOLS: "1" }],
    [
      "development with explicit disable",
      { DEV: true, VITE_DISABLE_REACT_DEVTOOLS: "1", VITE_ENABLE_DEV_TOOLS: "1" },
    ],
  ] as const)("keeps instrumentation off for %s", (_scenario, environment) => {
    // Given the environment fixture
    // When
    const enabled = shouldLoadReactDevTools(environment)

    // Then
    expect(enabled).toBe(false)
  })
})
