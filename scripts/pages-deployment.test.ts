import { execFileSync } from "node:child_process"
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { minVersion, satisfies, subset, valid } from "semver"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { deploymentBuildTimeoutMs } from "./pages-deployment-timeouts.ts"

const repositoryRoot = resolve(import.meta.dirname, "..")
const viteCli = resolve(repositoryRoot, "node_modules", "vite", "bin", "vite.js")
const packageManifestPath = resolve(repositoryRoot, "package.json")
const nodeVersionPath = resolve(repositoryRoot, ".node-version")
const jsdomManifestPath = resolve(repositoryRoot, "node_modules", "jsdom", "package.json")
const pagesWorkflowPath = resolve(repositoryRoot, ".github", "workflows", "deploy-pages.yml")
const ManifestSchema = z.object({
  start_url: z.string(),
  scope: z.string(),
  icons: z.array(z.object({ src: z.string() })),
})
const PackageManifestSchema = z.object({
  engines: z.object({ node: z.string().min(1) }),
  devDependencies: z.object({ jsdom: z.string().min(1) }),
})
const JsdomManifestSchema = z.object({
  version: z.string(),
  engines: z.object({ node: z.string().min(1) }),
})

function readWorkflowNodeVersionFile(): string {
  const workflow = readFileSync(pagesWorkflowPath, "utf8")
  const setupNodeStart = workflow.indexOf("- name: Set up Node.js")
  if (setupNodeStart < 0) {
    throw new Error("Pages workflow must declare a setup-node step")
  }
  const nextStep = workflow.indexOf("\n      - name:", setupNodeStart + 1)
  const setupNodeStep = workflow.slice(setupNodeStart, nextStep < 0 ? workflow.length : nextStep)
  if (/^\s*node-version:/m.test(setupNodeStep)) {
    throw new Error("Pages workflow must not hardcode node-version")
  }
  const sourcePath = /^\s*node-version-file:\s*([^\r\n#]+)/m.exec(setupNodeStep)?.[1]?.trim()
  if (sourcePath === undefined) {
    throw new Error("Pages workflow must reference node-version-file")
  }
  return sourcePath
}

type BuildOutput = {
  readonly assets: readonly string[]
  readonly devToolsAssets: readonly string[]
  readonly index: string
  readonly javaScript: string
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
    const assets = readdirSync(join(outputDirectory, "assets"))
    const javaScriptAssets = assets
      .filter((asset) => asset.endsWith(".js"))
      .map((asset) => ({
        asset,
        source: readFileSync(join(outputDirectory, "assets", asset), "utf8"),
      }))
    return {
      assets,
      devToolsAssets: javaScriptAssets
        .filter(
          ({ source }) =>
            source.includes("data-react-grab") || source.includes("reactScanIdCounter"),
        )
        .map(({ asset }) => asset),
      index: readFileSync(join(outputDirectory, "index.html"), "utf8"),
      javaScript: javaScriptAssets.map(({ source }) => source).join("\n"),
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
  it("runs the complete Pages build gate on pull requests without allowing a PR deployment", () => {
    // Given
    const workflow = readFileSync(pagesWorkflowPath, "utf8")

    // When
    const deployJob = workflow.slice(workflow.indexOf("\n  deploy:"))

    // Then
    expect(workflow).toMatch(/^\s{2}pull_request:\s*$/m)
    expect(workflow).toContain("run: pnpm test")
    expect(workflow).toContain("run: pnpm test:deployment")
    expect(workflow).toContain("run: pnpm typecheck")
    expect(workflow).toContain("run: pnpm lint")
    expect(workflow).toContain("run: pnpm build")
    expect(workflow).toContain("run: pnpm test:e2e:pages:artifact")
    expect(deployJob).toContain(
      "if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'",
    )
  })

  it("keeps the Pages Node runtime compatible with project and frozen jsdom engines", () => {
    // Given
    const packageManifest = PackageManifestSchema.parse(
      JSON.parse(readFileSync(packageManifestPath, "utf8")),
    )
    const jsdomManifest = JsdomManifestSchema.parse(
      JSON.parse(readFileSync(jsdomManifestPath, "utf8")),
    )
    const nodeVersion = valid(readFileSync(nodeVersionPath, "utf8").trim())
    const projectMinimum = minVersion(packageManifest.engines.node)
    const jsdomMinimum = minVersion(jsdomManifest.engines.node)

    if (nodeVersion === null) throw new Error(".node-version must contain a valid semver")
    if (projectMinimum === null) throw new Error("package.json engines.node must be a semver range")
    if (jsdomMinimum === null) throw new Error("jsdom engines.node must be a semver range")

    // When
    const workflowNodeVersionFile = readWorkflowNodeVersionFile()

    // Then
    expect(workflowNodeVersionFile).toBe(".node-version")
    expect(subset(packageManifest.engines.node, jsdomManifest.engines.node)).toBe(true)
    expect(satisfies(nodeVersion, packageManifest.engines.node)).toBe(true)
    expect(satisfies(nodeVersion, jsdomManifest.engines.node)).toBe(true)
    expect(satisfies(jsdomManifest.version, packageManifest.devDependencies.jsdom)).toBe(true)
    expect(satisfies("22.22.1", packageManifest.engines.node)).toBe(false)
    expect(satisfies("22.22.1", jsdomManifest.engines.node)).toBe(false)
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

  it("precaches the core shell without fetching the pilot-only runtime", () => {
    // Given
    const output = buildWithMode("pages")
    const coreScript = /src="[^"]+\/assets\/([^" ]+\.js)"/.exec(output.index)?.[1]
    const pilotChunks = output.assets.filter(
      (asset) => asset.startsWith("BrowserPilotRuntime-") && asset.endsWith(".js"),
    )

    // When
    const precachesPilotRuntime = pilotChunks.some((chunk) => output.serviceWorker.includes(chunk))

    // Then
    expect(coreScript).toBeDefined()
    expect(pilotChunks).toHaveLength(1)
    expect(output.serviceWorker).toContain(coreScript)
    expect(output.serviceWorker).toContain("index.html")
    expect(precachesPilotRuntime).toBe(false)
  })

  it("omits opt-in React inspection tools from production assets and the PWA precache", () => {
    // Given
    const output = buildWithMode("pages")

    // Then
    expect(output.javaScript).not.toContain("data-react-grab")
    expect(output.javaScript).not.toContain("reactScanIdCounter")
    expect(output.javaScript).not.toContain("react-grab")
    expect(output.javaScript).not.toContain("react-scan")
    expect(output.devToolsAssets).toEqual([])
    expect(output.devToolsAssets.every((asset) => !output.serviceWorker.includes(asset))).toBe(true)
  })
})
