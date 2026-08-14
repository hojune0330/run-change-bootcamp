import { spawnSync } from "node:child_process"
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { dirname, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { expectedPostgresVersion, matchesExpectedPostgresVersion } from "./postgres-version.mjs"

const expectedNodeVersion = "v22.23.2"
const expectedSupabaseVersion = "2.111.0"
const supportedModes = new Set(["fresh", "upgrade", "roles", "functions", "static"])
const mode = process.argv[2]

if (process.version !== expectedNodeVersion) {
  throw new Error(
    `security suite requires Node ${expectedNodeVersion}; observed ${process.version}`,
  )
}
if (!supportedModes.has(mode)) {
  throw new Error(
    `usage: node scripts/security/run-postgres-suite.mjs <${[...supportedModes].join("|")}>`,
  )
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
const migrationsDirectory = resolve(root, "supabase", "migrations")
const testsDirectory = resolve(root, "supabase", "tests")
const evidenceDirectory = resolve(
  process.env.SECURITY_EVIDENCE_DIR || resolve(root, ".omo", "evidence", "security"),
)
const psqlBinary = process.env.PSQL_BIN || (process.platform === "win32" ? "psql.exe" : "psql")
const databaseUrl =
  process.env.SECURITY_DATABASE_URL || "postgresql://postgres@127.0.0.1:5432/postgres"
const maintenanceUrl = new URL(databaseUrl)
maintenanceUrl.pathname = "/postgres"
const runToken = `${mode}_${process.pid}_${Date.now()}`
const summaryLog = `${mode}.log`

mkdirSync(evidenceDirectory, { recursive: true })
writeFileSync(resolve(evidenceDirectory, summaryLog), "", "utf8")

function sanitize(value) {
  return value.replace(/(postgres(?:ql)?:\/\/[^:\s/]+):[^@\s]+@/g, "$1:<redacted>@")
}

function append(logName, value) {
  appendFileSync(resolve(evidenceDirectory, logName), sanitize(value), "utf8")
}

function note(value) {
  const line = `${value}\n`
  process.stdout.write(line)
  append(summaryLog, line)
}

function run(binary, args, logName, options = {}) {
  const command = `${binary} ${args.join(" ")}`
  const result = spawnSync(binary, args, {
    cwd: root,
    encoding: "utf8",
    env: options.env || process.env,
    windowsHide: true,
  })
  const output = `${result.stdout || ""}${result.stderr || ""}`
  append(logName, `$ ${command}\n${output}\n[exit=${result.status ?? "spawn-error"}]\n`)
  if (result.error) {
    throw result.error
  }
  if (!options.allowFailure && result.status !== 0) {
    process.stderr.write(output)
    throw new Error(`${binary} exited ${result.status}; see ${resolve(evidenceDirectory, logName)}`)
  }
  return { output, status: result.status }
}

function psql(url, args, logName) {
  return run(psqlBinary, [url, "-X", "--set=ON_ERROR_STOP=1", ...args], logName)
}

function sqlFile(url, fileName, logName, expectedMarker) {
  const result = psql(url, ["--file", resolve(testsDirectory, fileName)], logName)
  if (expectedMarker && !result.output.includes(expectedMarker)) {
    throw new Error(`${fileName} did not emit ${expectedMarker}`)
  }
  if (expectedMarker) {
    note(`[security-db] ${expectedMarker}`)
  }
}

function migrationFiles() {
  return readdirSync(migrationsDirectory)
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort()
}

function applyBootstrap(url, logName) {
  sqlFile(url, "portable_supabase_bootstrap.sql", logName)
}

function applyMigrations(url, logName, predicate = () => true, requireSelection = true) {
  const selected = migrationFiles().filter(predicate)
  if (requireSelection && selected.length === 0) {
    throw new Error("no migrations selected")
  }
  for (const name of selected) {
    psql(url, ["--file", resolve(migrationsDirectory, name)], logName)
  }
}

function databaseName(label) {
  return `plus_t5_${label}_${runToken}`.replaceAll(/[^a-z0-9_]/g, "_").slice(0, 63)
}

function databaseConnection(name) {
  const url = new URL(databaseUrl)
  url.pathname = `/${name}`
  return url.toString()
}

function withDatabase(label, logName, scenario) {
  const name = databaseName(label)
  const connection = databaseConnection(name)
  writeFileSync(resolve(evidenceDirectory, logName), "", "utf8")
  psql(
    maintenanceUrl.toString(),
    ["--command", `drop database if exists ${name} with (force)`],
    logName,
  )
  psql(maintenanceUrl.toString(), ["--command", `create database ${name}`], logName)
  try {
    const version = psql(
      connection,
      ["--tuples-only", "--no-align", "--command", "select current_setting('server_version')"],
      logName,
    )
    if (!matchesExpectedPostgresVersion(version.output)) {
      throw new Error(
        `security suite requires PostgreSQL ${expectedPostgresVersion}; observed ${version.output.trim()}`,
      )
    }
    scenario(connection, logName)
  } finally {
    psql(
      maintenanceUrl.toString(),
      ["--command", `drop database if exists ${name} with (force)`],
      logName,
    )
  }
}

function freshDatabase(connection, logName) {
  applyBootstrap(connection, logName)
  applyMigrations(connection, logName)
}

function runActivityInsightSuite(connection, logName) {
  sqlFile(connection, "activity_insight_fixture.sql", logName, "ACTIVITY_INSIGHT_FIXTURE_READY")
  sqlFile(
    connection,
    "activity_insight_acceptance_test.sql",
    logName,
    "ACTIVITY_INSIGHT_ACCEPTANCE_PASS",
  )
  sqlFile(connection, "activity_insight_happy_test.sql", logName, "ACTIVITY_INSIGHT_HAPPY_PASS")
  sqlFile(connection, "activity_insight_hostile_test.sql", logName, "ACTIVITY_INSIGHT_HOSTILE_PASS")
}

function runFreshSuite() {
  withDatabase("fresh_schema", "fresh-install.log", (connection, logName) => {
    freshDatabase(connection, logName)
    sqlFile(connection, "security_schema_test.sql", logName, "SECURITY_SCHEMA_PASS")
    runActivityInsightSuite(connection, logName)
  })
  withDatabase("measurement", "preserve-measurement.log", (connection, logName) => {
    freshDatabase(connection, logName)
    note("[security-db] SECURITY_FINAL_013_MEASUREMENT_START")
    sqlFile(connection, "measurement_protocol_test.sql", logName, "MEASUREMENT_PROTOCOL_SQL_PASS")
    note("[security-db] SECURITY_FINAL_013_MEASUREMENT_PASS")
  })
  withDatabase("privacy", "preserve-privacy.log", (connection, logName) => {
    freshDatabase(connection, logName)
    note("[security-db] SECURITY_FINAL_013_PRIVACY_START")
    sqlFile(
      connection,
      "privacy_audiences_contract_test.sql",
      logName,
      "PRIVACY_AUDIENCES_CONTRACT_PASS",
    )
    note("[security-db] SECURITY_FINAL_013_PRIVACY_PASS")
  })
  withDatabase("lifecycle", "preserve-lifecycle.log", (connection, logName) => {
    freshDatabase(connection, logName)
    note("[security-db] SECURITY_FINAL_013_LIFECYCLE_START")
    sqlFile(connection, "lifecycle_happy_test.sql", logName, "LIFECYCLE_HAPPY_OK")
    sqlFile(connection, "lifecycle_hostile_test.sql", logName, "LIFECYCLE_HOSTILE_OK")
    sqlFile(connection, "security_schema_test.sql", logName, "SECURITY_SCHEMA_PASS")
    note("[security-db] SECURITY_FINAL_013_LIFECYCLE_PASS")
  })
  note("SECURITY_FRESH_PASS")
}

function runUpgradeSuite() {
  withDatabase("upgrade", "upgrade.log", (connection, logName) => {
    applyBootstrap(connection, logName)
    applyMigrations(connection, logName, (name) => /^2026073100(0[1-9]|1[0-2])_/.test(name))
    sqlFile(connection, "security_upgrade_test.sql", logName, "SECURITY_UPGRADE_PASS")
    applyMigrations(
      connection,
      logName,
      (name) => name > "202607310013_security_role_matrix.sql",
      false,
    )
    sqlFile(connection, "security_schema_test.sql", logName, "SECURITY_SCHEMA_PASS")
    sqlFile(
      connection,
      "security_function_boundary_test.sql",
      logName,
      "SECURITY_FUNCTION_BOUNDARY_PASS",
    )
    runActivityInsightSuite(connection, logName)
  })
  note("SECURITY_UPGRADE_SUITE_PASS")
}

function runRolesSuite() {
  for (const pass of [1, 2]) {
    withDatabase(`roles_${pass}`, `roles-pass-${pass}.log`, (connection, logName) => {
      freshDatabase(connection, logName)
      sqlFile(connection, "security_role_fixture.sql", logName, "SECURITY_ROLE_FIXTURE_PASS")
      sqlFile(connection, "security_role_matrix_test.sql", logName, "SECURITY_ROLE_MATRIX_PASS")
    })
  }
  note("SECURITY_ROLES_PASS")
}

function findHookTests(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = resolve(directory, entry.name)
    if (entry.isDirectory()) return findHookTests(target)
    if (!/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) return []
    const source = readFileSync(target, "utf8")
    return /send-pilot-magic-link|send_email|magic link|auth hook/i.test(`${entry.name}\n${source}`)
      ? [target]
      : []
  })
}

function validateSupabaseConfig() {
  const binary =
    process.env.SUPABASE_BIN || (process.platform === "win32" ? "supabase.exe" : "supabase")
  const version = run(binary, ["--version"], "supabase-version.log")
  if (version.output.trim() !== expectedSupabaseVersion) {
    throw new Error(
      `security suite requires Supabase CLI ${expectedSupabaseVersion}; observed ${version.output.trim()}`,
    )
  }
  const missingSecretEnvironment = { ...process.env }
  delete missingSecretEnvironment.SEND_EMAIL_HOOK_SECRET
  const missing = run(
    binary,
    ["status", "--workdir", root, "--output", "json"],
    "config-missing-secret.log",
    {
      allowFailure: true,
      env: missingSecretEnvironment,
    },
  )
  if (
    missing.status === 0 ||
    !/auth\.hook\.send_email\.secrets|SEND_EMAIL_HOOK_SECRET|Invalid hook config/i.test(
      missing.output,
    )
  ) {
    throw new Error("Supabase config did not fail closed when SEND_EMAIL_HOOK_SECRET was absent")
  }
  note("SUPABASE_CONFIG_MISSING_SECRET_REJECTED")
  const validSecretEnvironment = {
    ...process.env,
    SEND_EMAIL_HOOK_SECRET: "v1,whsec_QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUE=",
  }
  const valid = run(
    binary,
    ["status", "--workdir", root, "--output", "json"],
    "config-valid-secret.log",
    {
      allowFailure: true,
      env: validSecretEnvironment,
    },
  )
  if (/Invalid hook config|failed to parse.*config/i.test(valid.output)) {
    throw new Error("Supabase config rejected a correctly formatted hook secret")
  }
  note("SUPABASE_CONFIG_VALID_SECRET_PARSED")
}

function runFunctionsSuite() {
  withDatabase("functions", "functions.log", (connection, logName) => {
    freshDatabase(connection, logName)
    sqlFile(
      connection,
      "security_function_boundary_test.sql",
      logName,
      "SECURITY_FUNCTION_BOUNDARY_PASS",
    )
  })
  validateSupabaseConfig()
  const hookTests = findHookTests(resolve(root, "src")).concat(
    findHookTests(resolve(root, "supabase", "functions")),
  )
  if (hookTests.length > 0) {
    const vitest = resolve(root, "node_modules", "vitest", "vitest.mjs")
    run(
      process.execPath,
      [vitest, "run", ...hookTests.map((file) => relative(root, file))],
      "function-hooks.log",
    )
    note(`SECURITY_FUNCTION_HOOK_TESTS_PASS count=${hookTests.length}`)
  }
  note("SECURITY_FUNCTIONS_PASS")
}

function runStaticSuite() {
  const vitest = resolve(root, "node_modules", "vitest", "vitest.mjs")
  run(process.execPath, [vitest, "run", "src/integrations/sql-policy.test.ts"], "static.log")
  note("SECURITY_STATIC_PASS")
}

run(psqlBinary, ["--version"], "runtime-versions.log")
const psqlVersion = readFileSync(resolve(evidenceDirectory, "runtime-versions.log"), "utf8")
if (!psqlVersion.includes(`psql (PostgreSQL) ${expectedPostgresVersion}`)) {
  throw new Error(`psql must be PostgreSQL ${expectedPostgresVersion}`)
}
append("runtime-versions.log", `node ${process.version}\n`)
note(`SECURITY_RUNTIME_PASS node=${process.version} postgres=${expectedPostgresVersion}`)

if (mode === "fresh") runFreshSuite()
if (mode === "upgrade") runUpgradeSuite()
if (mode === "roles") runRolesSuite()
if (mode === "functions") runFunctionsSuite()
if (mode === "static") runStaticSuite()

note(`SECURITY_SUITE_PASS mode=${mode}`)
