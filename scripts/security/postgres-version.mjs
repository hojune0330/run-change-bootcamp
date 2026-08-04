export const expectedPostgresVersion = "17.10"

export function matchesExpectedPostgresVersion(value) {
  const observed = String(value).trim()
  return observed === expectedPostgresVersion || observed.startsWith(`${expectedPostgresVersion} `)
}
