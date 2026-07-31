import type { ImportArtifact } from "../../domain"
import { parseAppleXml } from "./apple"
import { parseCsv } from "./csv"
import { parseFit } from "./fit"
import { parseGpx } from "./gpx"
import type { ImportParseResult } from "./result"
import { parseSamsungJson } from "./samsung"
import { parseTcx } from "./tcx"

class UnexpectedImportFormatError extends Error {
  readonly name = "UnexpectedImportFormatError"
}

function assertNever(value: never): never {
  throw new UnexpectedImportFormatError(`Unexpected import format: ${String(value)}`)
}

export function parseImportArtifact(artifact: ImportArtifact, content: string): ImportParseResult {
  switch (artifact.format) {
    case "csv":
      return parseCsv(artifact, content)
    case "fit":
      return parseFit()
    case "gpx":
      return parseGpx(artifact, content)
    case "tcx":
      return parseTcx(artifact, content)
    case "apple-xml":
      return parseAppleXml(artifact, content)
    case "samsung-json":
      return parseSamsungJson(artifact, content)
    default:
      return assertNever(artifact.format)
  }
}

export type { ImportIssue, ImportIssueCode, ImportParseResult } from "./result"
