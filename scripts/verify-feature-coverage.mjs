import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"

const REQUIRED_COLUMNS = [
  "feature_id",
  "promise",
  "surface_route",
  "role",
  "preview_status",
  "pilot_repository_method",
  "backend_object",
  "automated_scenario",
  "manual_scenario",
  "evidence_path",
  "disposition",
]
const OWNERSHIP_COLUMNS = ["pilot_repository_method", "backend_object"]
const EVIDENCE_COLUMNS = ["automated_scenario", "manual_scenario", "evidence_path"]
const DISPOSITIONS = new Set(["retained", "replaced", "added", "forbidden"])
const NO_IMPLEMENTATION =
  /^(?:none|n\/a|na|not applicable|forbidden(?:\b|:)|no (?:repository|implementation|owner)|—|-)/i

function parseArguments(argv) {
  const options = { matrix: undefined, json: undefined }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === "--matrix") {
      options.matrix = argv[index + 1]
      index += 1
      continue
    }
    if (argument === "--json") {
      options.json = argv[index + 1]
      index += 1
      continue
    }
    throw new Error(`Unknown argument: ${argument}`)
  }
  if (options.matrix === undefined) throw new Error("Missing required --matrix path")
  return options
}

function parseMatrix(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
  if (lines.length < 2)
    throw new Error("Coverage matrix must include a header and at least one row")
  const header = lines[0].split("\t")
  const duplicateColumns = header.filter((column, index) => header.indexOf(column) !== index)
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !header.includes(column))
  if (duplicateColumns.length > 0 || missingColumns.length > 0) {
    throw new Error(
      `Invalid header; duplicate columns: ${[...new Set(duplicateColumns)].join(", ") || "none"}; missing columns: ${missingColumns.join(", ") || "none"}`,
    )
  }
  const rows = lines.slice(1).map((line, offset) => {
    const values = line.split("\t")
    const row = Object.fromEntries(header.map((column, index) => [column, values[index] ?? ""]))
    return { line: offset + 2, row, width: values.length, expectedWidth: header.length }
  })
  return { header, rows }
}

function isBlank(value) {
  return value.trim().length === 0
}

function hasNoImplementation(value) {
  return NO_IMPLEMENTATION.test(value.trim())
}

function validateMatrix(matrix, matrixPath) {
  const errors = []
  const duplicateIds = []
  const unownedRows = []
  const invalidRows = []
  const forbiddenOwnershipRows = []
  const seenIds = new Map()

  for (const entry of matrix.rows) {
    const { line, row, width, expectedWidth } = entry
    const rowErrors = []
    if (width !== expectedWidth)
      rowErrors.push(`expected ${expectedWidth} columns, received ${width}`)
    for (const column of REQUIRED_COLUMNS) {
      if (isBlank(row[column])) rowErrors.push(`blank required field: ${column}`)
    }
    const featureId = row.feature_id.trim()
    if (featureId.length > 0) {
      const firstLine = seenIds.get(featureId)
      if (firstLine !== undefined) {
        duplicateIds.push(featureId)
        rowErrors.push(`duplicate feature_id; first declared on line ${firstLine}`)
      } else {
        seenIds.set(featureId, line)
      }
    }
    if (!DISPOSITIONS.has(row.disposition.trim())) {
      rowErrors.push(`unknown disposition: ${row.disposition}`)
    }

    const previewStatus = row.preview_status.trim().toLowerCase()
    const pilotRequired = /\bpilot(?:[- _]?required|[- _]?only)\b/.test(previewStatus)
    if (pilotRequired) {
      const proofless = ["surface_route", ...OWNERSHIP_COLUMNS].filter(
        (column) => isBlank(row[column]) || hasNoImplementation(row[column]),
      )
      if (proofless.length > 0) {
        unownedRows.push({ line, feature_id: featureId, fields: proofless })
        rowErrors.push(`pilot-required row lacks route/ownership proof: ${proofless.join(", ")}`)
      }
    }
    if (row.disposition.trim() === "forbidden") {
      const ownedFields = OWNERSHIP_COLUMNS.filter(
        (column) => !isBlank(row[column]) && !hasNoImplementation(row[column]),
      )
      if (ownedFields.length > 0) {
        forbiddenOwnershipRows.push({ line, feature_id: featureId, fields: ownedFields })
        rowErrors.push(`forbidden row has implementation ownership: ${ownedFields.join(", ")}`)
      }
    }
    if (rowErrors.length > 0) invalidRows.push({ line, feature_id: featureId, errors: rowErrors })
  }

  for (const entry of invalidRows) {
    for (const error of entry.errors)
      errors.push(`line ${entry.line} (${entry.feature_id || "missing id"}): ${error}`)
  }
  for (const column of EVIDENCE_COLUMNS) {
    if (!REQUIRED_COLUMNS.includes(column))
      errors.push(`internal verifier error: unknown evidence column ${column}`)
  }

  return {
    ok: errors.length === 0,
    matrix: matrixPath,
    columns: matrix.header,
    row_count: matrix.rows.length,
    valid_rows: matrix.rows.length - invalidRows.length,
    duplicate_ids: [...new Set(duplicateIds)],
    unowned_rows: unownedRows,
    invalid_rows: invalidRows,
    forbidden_ownership_rows: forbiddenOwnershipRows,
    errors,
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function main() {
  let options
  try {
    options = parseArguments(process.argv.slice(2))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid command line"
    console.error(message)
    process.exitCode = 1
    return
  }

  const matrixPath = resolve(process.cwd(), options.matrix)
  const jsonPath = options.json === undefined ? undefined : resolve(process.cwd(), options.json)
  let report
  try {
    const matrix = parseMatrix(readFileSync(matrixPath, "utf8"))
    report = validateMatrix(matrix, matrixPath)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read coverage matrix"
    report = {
      ok: false,
      matrix: matrixPath,
      columns: [],
      row_count: 0,
      valid_rows: 0,
      duplicate_ids: [],
      unowned_rows: [],
      invalid_rows: [],
      forbidden_ownership_rows: [],
      errors: [message],
    }
  }
  if (jsonPath !== undefined) writeJson(jsonPath, report)
  console.log(JSON.stringify(report, null, 2))
  process.exitCode = report.ok ? 0 : 1
}

main()
