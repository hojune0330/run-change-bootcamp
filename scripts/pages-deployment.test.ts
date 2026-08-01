import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { deploymentBuildTimeoutMs } from "./pages-deployment-timeouts.ts"

const repositoryRoot = resolve(import.meta.dirname, "..")
const viteCli = resolve(repositoryRoot, "node_modules", "vite", "bin", "vite.js")
const packageManifestPath = resolve(repositoryRoot, "package.json")
const pagesWorkflowPath = resolve(repositoryRoot, ".github", "workflows", "deploy-pages.yml")
const ManifestSchema = z.object({
  start_url: z.string(),
  scope: z.string(),
  icons: z.array(z.object({ src: z.string() })),
})
const PackageManifestSchema = z.object({
  packageManager: z.string().regex(/^pnpm@\d+\.\d+\.\d+$/),
  engines: z.object({ node: z.string().regex(/^>=\d+\.\d+\.\d+$/) }),
})

type NodeVersion = Readonly<{
  major: number
  minor: number
  patch: number
}>

function parseNodeVersion(value: string): NodeVersion {
  const [majorText, minorText, patchText] = value.split(".")
  if (majorText === undefined || minorText === undefined || patchText === undefined) {
    throw new Error(`Invalid Node version: ${value}`)
  }

  const version = {
    major: Number(majorText),
    minor: Number(minorText),
    patch: Number(patchText),
  }
  if (Object.values(version).some((part) => !Number.isInteger(part) || part < 0)) {
    throw new Error(`Invalid Node version: ${value}`)
  }
  return version
}

function compareNodeVersions(left: NodeVersion, right: NodeVersion): number {
  if (left.major !== right.major) return left.major - right.major
  if (left.minor !== right.minor) return left.minor - right.minor
  return left.patch - right.patch
}

function parseNodeEngineLowerBound(engine: string): NodeVersion {
  const minimumVersion = engine.slice(2)
  return parseNodeVersion(minimumVersion)
}

function readWorkflowNodeVersion(): Readonly<{ text: string; version: NodeVersion }> {
  const workflow = readFileSync(pagesWorkflowPath, "utf8")
  const versionText = /node-version:\s*([0-9]+\.[0-9]+\.[0-9]+)/.exec(workflow)?.[1]
  if (versionText === undefined) {
    throw new Error("Pages workflow must declare a setup-node version")
  }
  return { text: versionText, version: parseNodeVersion(versionText) }
}

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
  it("keeps the Pages Node runtime compatible with project and pnpm engines", () => {
    // Given
    const packageManifest = PackageManifestSchema.parse(
      JSON.parse(readFileSync(packageManifestPath, "utf8")),
    )
    const workflowNode = readWorkflowNodeVersion()
    const projectNodeLowerBound = parseNodeEngineLowerBound(packageManifest.engines.node)
    const pnpm11_9_0NodeLowerBound = parseNodeVersion("22.13.0")

    // When
    const projectNodeComparison = compareNodeVersions(workflowNode.version, projectNodeLowerBound)
    const pnpmNodeComparison = compareNodeVersions(workflowNode.version, pnpm11_9_0NodeLowerBound)

    // Then
    expect(
      projectNodeComparison,
      `Pages Node ${workflowNode.text} must satisfy project engine ${packageManifest.engines.node}`,
    ).toBeGreaterThanOrEqual(0)
    expect(
      pnpmNodeComparison,
      `Pages Node ${workflowNode.text} must satisfy ${packageManifest.packageManager} Node >=22.13`,
    ).toBeGreaterThanOrEqual(0)
  })

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
