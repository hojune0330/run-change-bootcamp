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

  it("resolves the branded about surface and administrative shell routes", () => {
    expect(resolveRoute("/about")).toEqual({ kind: "about" })
    expect(resolveRoute("/admin/overview")).toEqual({
      kind: "admin",
      href: "/admin/overview",
    })
    expect(resolveRoute("/admin/settings")).toEqual({
      kind: "admin",
      href: "/admin/settings",
    })
  })

  it("normalizes GitHub Pages directory slashes without changing the base root", () => {
    // Given
    const pagesBasePath = "/run-change-bootcamp/"

    // When
    const trailingSlashPath = `${pagesBasePath}record/`

    // Then
    expect(toAppPath(pagesBasePath, pagesBasePath)).toBe("/")
    expect(toAppPath(trailingSlashPath, pagesBasePath)).toBe("/record")
    expect(resolveRoute(trailingSlashPath, pagesBasePath)).toEqual({
      kind: "participant",
      href: "/record",
    })
    expect(resolveRoute(`${pagesBasePath}about/`, pagesBasePath)).toEqual({ kind: "about" })
    expect(resolveRoute(`${pagesBasePath}unknown/`, pagesBasePath)).toEqual({
      kind: "not_found",
    })
  })
})
