import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("published metadata", () => {
  it("declares the existing app icon so preview does not request a missing favicon", () => {
    // Given
    const indexPath = resolve(import.meta.dirname, "../../index.html")

    // When
    const index = readFileSync(indexPath, "utf8")

    // Then
    expect(index).toContain('<link rel="icon" href="%BASE_URL%icon-any.svg"')
  })

  it("provides a valid robots policy at both preview and Pages paths", () => {
    // Given
    const robotsPath = resolve(import.meta.dirname, "../../public/robots.txt")

    // When
    const robots = readFileSync(robotsPath, "utf8")

    // Then
    expect(robots).toMatch(/^User-agent:\s*\*\s*$/m)
    expect(robots).toMatch(/^Allow:\s*\/\s*$/m)
  })
})
