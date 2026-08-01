import { describe, expect, it } from "vitest"
import { toAppPath, toBrowserPath } from "./base-path.ts"
import { resolveRoute } from "./routes.ts"

describe("GitHub Pages subpath routing", () => {
  it("resolves only an exact participant route below the repository base path", () => {
    // Given
    const directRoutePath = "/run-change-bootcamp/record"

    // When
    const route = resolveRoute(directRoutePath, "/run-change-bootcamp/")

    // Then
    expect(route).toEqual({ kind: "participant", href: "/record" })
    expect(resolveRoute(`${directRoutePath}/abc`, "/run-change-bootcamp/")).toEqual({
      kind: "not_found",
    })
  })

  it("keeps client-side links inside the repository base path", () => {
    // Given
    const basePath = "/run-change-bootcamp/"

    // When
    const browserPath = toBrowserPath("/record", basePath)

    // Then
    expect(browserPath).toBe("/run-change-bootcamp/record")
    expect(toAppPath(browserPath, basePath)).toBe("/record")
  })

  it("keeps local development routes at the origin root", () => {
    // Given
    const localBasePath = "/"

    // When
    const browserPath = toBrowserPath("/record", localBasePath)

    // Then
    expect(browserPath).toBe("/record")
    expect(toAppPath(browserPath, localBasePath)).toBe("/record")
    expect(resolveRoute(browserPath, localBasePath)).toEqual({
      kind: "participant",
      href: "/record",
    })
  })
})
