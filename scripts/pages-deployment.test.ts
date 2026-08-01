import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { z } from "zod"

const repositoryRoot = resolve(import.meta.dirname, "..")
const viteCli = resolve(repositoryRoot, "node_modules", "vite", "bin", "vite.js")
const deploymentBuildTimeoutMs = 15_000
const ManifestSchema = z.object({
  start_url: z.string(),
  scope: z.string(),
  icons: z.array(z.object({ src: z.string() })),
})

type BuildOutput = {
  readonly index: string
  readonly manifest: z.infer<typeof ManifestSchema>
  readonly serviceWorker: string
}

function buildWithMode(mode: "preview" | "pages"): BuildOutput {
  const outputDirectory = mkdtempSync(join(tmpdir(), `run-change-${mode}-`))

  try {
    execFileSync(
      process.execPath,
      [viteCli, "build", "--mode", mode, "--outDir", outputDirectory],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: deploymentBuildTimeoutMs,
      },
    )
    return {
      index: readFileSync(join(outputDirectory, "index.html"), "utf8"),
      manifest: ManifestSchema.parse(
        JSON.parse(readFileSync(join(outputDirectory, "manifest.webmanifest"), "utf8")),
      ),
      serviceWorker: readFileSync(join(outputDirectory, "sw.js"), "utf8"),
    }
  } finally {
    rmSync(outputDirectory, { force: true, recursive: true })
  }
}

describe("Vite/PWA deployment modes", () => {
  it("keeps local production assets and PWA routes at the origin root", () => {
    // Given
    const output = buildWithMode("preview")

    // When
    const localScriptUsesRoot = /src="\/assets\/[^" ]+\.js"/.test(output.index)

    // Then
    expect(localScriptUsesRoot).toBe(true)
    expect(output.index).not.toContain("/run-change-bootcamp/")
    expect(output.manifest.start_url).toBe("/")
    expect(output.manifest.scope).toBe("/")
    expect(output.manifest.icons.every((icon) => icon.src.startsWith("/"))).toBe(true)
    expect(
      output.manifest.icons.every((icon) => !icon.src.startsWith("/run-change-bootcamp/")),
    ).toBe(true)
    expect(output.serviceWorker).toContain('createHandlerBoundToURL("/index.html")')
  })

  it("scopes Pages assets and navigation to the repository path", () => {
    // Given
    const output = buildWithMode("pages")

    // When
    const pagesScriptUsesBase = /src="\/run-change-bootcamp\/assets\/[^" ]+\.js"/.test(output.index)

    // Then
    expect(pagesScriptUsesBase).toBe(true)
    expect(output.manifest.start_url).toBe("/run-change-bootcamp/")
    expect(output.manifest.scope).toBe("/run-change-bootcamp/")
    expect(
      output.manifest.icons.every((icon) => icon.src.startsWith("/run-change-bootcamp/")),
    ).toBe(true)
    expect(output.serviceWorker).toContain(
      'createHandlerBoundToURL("/run-change-bootcamp/index.html")',
    )
    expect(output.serviceWorker).not.toContain('createHandlerBoundToURL("/index.html")')
  })
})
