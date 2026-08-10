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
const devToolsSourceMarkers = [
  "data-react-grab",
  "reactScanIdCounter",
  "react-grab",
  "react-scan",
] as const
const devToolsEntryFileName = /react[-_.]?(?:grab|scan)(?:[-_.]|$)/i
const ManifestSchema = z.object({
  start_url: z.string(),
  scope: z.string(),
  icons: z.array(z.object({ src: z.string() })),
})
const PackageManifestSchema = z.object({
  engines: z.object({ node: z.string().min(1) }),
  devDependencies: z.object({ jsdom: z.string().min(1) }),
  scripts: z.record(z.string(), z.string()),
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
  readonly precacheAssets: readonly string[]
  readonly serviceWorker: string
}

type JavaScriptAsset = {
  readonly asset: string
  readonly source: string
}

function findDevToolsAssets(javaScriptAssets: readonly JavaScriptAsset[]): readonly string[] {
  return javaScriptAssets
    .filter(({ source }) => devToolsSourceMarkers.some((marker) => source.includes(marker)))
    .map(({ asset }) => asset)
}

function parsePrecacheAssetNames(serviceWorker: string): readonly string[] {
  const assetNames = Array.from(
    serviceWorker.matchAll(/\burl\s*:\s*["']([^"']+)["']/g),
    (match) => {
      const rawUrl = match[1]
      if (rawUrl === undefined) throw new Error("Precache URL capture must be defined")

      const pathname = new URL(rawUrl, "https://pwa.invalid").pathname.replaceAll("\\", "/")
      const fileName = pathname.split("/").at(-1)
      if (fileName === undefined || fileName.length === 0) {
        throw new Error(`Precache URL must end with a filename: ${rawUrl}`)
      }
      return decodeURIComponent(fileName)
    },
  )
  return [...new Set(assetNames)]
}

function findPrecachedAssets(
  candidateAssets: readonly string[],
  precacheAssets: readonly string[],
): readonly string[] {
  const precacheAssetSet = new Set(precacheAssets)
  return candidateAssets.filter((asset) => precacheAssetSet.has(asset))
}

function findRecognizableDevToolsEntries(precacheAssets: readonly string[]): readonly string[] {
  return precacheAssets.filter((asset) => devToolsEntryFileName.test(asset))
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
    const serviceWorker = readFileSync(join(outputDirectory, "sw.js"), "utf8")
    return {
      assets,
      devToolsAssets: findDevToolsAssets(javaScriptAssets),
      index: readFileSync(join(outputDirectory, "index.html"), "utf8"),
      javaScript: javaScriptAssets.map(({ source }) => source).join("\n"),
      manifest: ManifestSchema.parse(
        JSON.parse(readFileSync(join(outputDirectory, "manifest.webmanifest"), "utf8")),
      ),
      precacheAssets: parsePrecacheAssetNames(serviceWorker),
      serviceWorker,
    }
  } finally {
    rmSync(outputDirectory, { force: true, recursive: true })
  }
}

describe("Vite/PWA deployment modes", () => {
  it("runs the complete Pages build gate on pull requests without allowing a PR deployment", () => {
    // Given
    const workflow = readFileSync(pagesWorkflowPath, "utf8")
    const packageManifest = PackageManifestSchema.parse(
      JSON.parse(readFileSync(packageManifestPath, "utf8")),
    )

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
    expect(workflow).toContain("run: pnpm test:e2e:poc:artifact")
    expect(packageManifest.scripts["test:e2e:poc:artifact"]).toBe(
      "playwright test e2e/poc-ux.spec.ts",
    )
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
    const syntheticDevToolsAsset = {
      asset: "react-grab-entry-deadbeef.js",
      source: 'import("react-grab")',
    }
    const syntheticServiceWorker =
      'precacheAndRoute([{revision:"deadbeef",url:"/run-change-bootcamp/assets/react-grab-entry-deadbeef.js?revision=1#asset"}])'

    // When
    const syntheticDevToolsAssets = findDevToolsAssets([syntheticDevToolsAsset])
    const syntheticPrecacheAssets = parsePrecacheAssetNames(syntheticServiceWorker)

    // Then
    expect(syntheticDevToolsAssets).toEqual([syntheticDevToolsAsset.asset])
    expect(syntheticPrecacheAssets).toContain(syntheticDevToolsAsset.asset)
    expect(findPrecachedAssets(syntheticDevToolsAssets, syntheticPrecacheAssets)).toEqual([
      syntheticDevToolsAsset.asset,
    ])
    expect(findRecognizableDevToolsEntries(syntheticPrecacheAssets)).toEqual([
      syntheticDevToolsAsset.asset,
    ])

    const output = buildWithMode("pages")
    const precachedDevToolsAssets = findPrecachedAssets(
      output.devToolsAssets,
      output.precacheAssets,
    )
    const recognizableDevToolsEntries = findRecognizableDevToolsEntries(output.precacheAssets)

    expect(output.javaScript).not.toContain("data-react-grab")
    expect(output.javaScript).not.toContain("reactScanIdCounter")
    expect(output.javaScript).not.toContain("react-grab")
    expect(output.javaScript).not.toContain("react-scan")
    expect(precachedDevToolsAssets).toEqual([])
    expect(recognizableDevToolsEntries).toEqual([])
    expect(output.devToolsAssets).toEqual([])
    expect(output.serviceWorker).not.toContain("data-react-grab")
    expect(output.serviceWorker).not.toContain("reactScanIdCounter")
    expect(output.serviceWorker).not.toContain("react-grab")
    expect(output.serviceWorker).not.toContain("react-scan")
  })
})
