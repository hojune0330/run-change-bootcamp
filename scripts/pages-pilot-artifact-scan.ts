export type ArtifactTextFile = {
  readonly path: string
  readonly source: string
}

export type PagesPilotArtifact = {
  readonly indexHtml: string
  readonly precacheAssetNames: readonly string[]
  readonly textFiles: readonly ArtifactTextFile[]
}

export type PilotArtifactLeaks = {
  readonly contentFiles: readonly string[]
  readonly emittedNamedFiles: readonly string[]
  readonly loadGraphReferences: readonly {
    readonly source: string
    readonly target: string
  }[]
  readonly precacheEntries: readonly string[]
}

const privateRuntimeMarker = /(?:pilot|stage[-_.]?2)/i
const pilotRuntimeContent =
  /BrowserPilotRuntime|PilotRuntime|Stage2Runtime|PilotApplication|PilotAuthShell|PilotConfigurationBlocked|createBrowserPilotGateway|run-change:pilot-auth|bootstrap_pilot_membership|pilot-entry__|pilot-workspace__/i
const scriptOrStyle = /\.(?:css|js)$/i

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort()
}

function pilotAssetReferences(source: string): readonly string[] {
  return uniqueSorted(
    Array.from(
      source.matchAll(/(?:assets\/)?[a-z0-9._-]*(?:pilot|stage[-_.]?2)[a-z0-9._-]*\.(?:css|js)/gi),
      (match) => match[0],
    ),
  )
}

export function findPilotArtifactLeaks(artifact: PagesPilotArtifact): PilotArtifactLeaks {
  const emittedNamedFiles = artifact.textFiles
    .filter((file) => scriptOrStyle.test(file.path) && privateRuntimeMarker.test(file.path))
    .map((file) => file.path)
    .sort()
  const contentFiles = artifact.textFiles
    .filter((file) => scriptOrStyle.test(file.path) && pilotRuntimeContent.test(file.source))
    .map((file) => file.path)
    .sort()
  const dependencySources = [
    { path: "index.html", source: artifact.indexHtml },
    ...artifact.textFiles.filter((file) => scriptOrStyle.test(file.path)),
  ]
  const loadGraphReferences = dependencySources
    .flatMap((file) =>
      pilotAssetReferences(file.source).map((target) => ({ source: file.path, target })),
    )
    .sort((left, right) =>
      left.source === right.source
        ? left.target.localeCompare(right.target)
        : left.source.localeCompare(right.source),
    )
  const precacheEntries = uniqueSorted(
    artifact.precacheAssetNames.filter(
      (asset) => scriptOrStyle.test(asset) && privateRuntimeMarker.test(asset),
    ),
  )

  return { contentFiles, emittedNamedFiles, loadGraphReferences, precacheEntries }
}
