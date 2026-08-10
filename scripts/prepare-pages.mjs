import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs"
import { relative, resolve, sep } from "node:path"

const projectRoot = process.cwd()
const outputDirectory = process.argv[2] ?? "dist"
const distDirectory = resolve(projectRoot, outputDirectory)
const indexPath = resolve(distDirectory, "index.html")
const fallbackPath = resolve(distDirectory, "404.html")
const routeContractPath = resolve(projectRoot, "src", "app", "routes-contract.ts")
const routeContractNames = ["PARTICIPANT_HREFS", "COACH_HREFS", "ADMIN_HREFS"]

function readRouteHrefs(name) {
  const source = readFileSync(routeContractPath, "utf8")
  const declaration = new RegExp(
    `export const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s+as const`,
  ).exec(source)
  if (declaration?.[1] === undefined) {
    throw new Error(`Cannot find the ${name} route contract in ${routeContractPath}.`)
  }

  const hrefs = Array.from(declaration[1].matchAll(/"(\/[^"]+)"/g), (match) => match[1])
  if (hrefs.length === 0 || hrefs.some((href) => href === undefined)) {
    throw new Error(`The ${name} route contract must contain at least one href.`)
  }
  return hrefs
}

const routeHrefs = routeContractNames.flatMap((name) => readRouteHrefs(name))
const uniqueRouteHrefs = new Set(routeHrefs)
if (uniqueRouteHrefs.size !== routeHrefs.length) {
  throw new Error("The Pages route contracts must not contain duplicate hrefs.")
}

if (!existsSync(indexPath)) {
  throw new Error(`Cannot create the Pages fallback because ${indexPath} does not exist.`)
}

copyFileSync(indexPath, fallbackPath)

for (const href of routeHrefs) {
  const routeDirectory = resolve(distDirectory, href.slice(1))
  const relativeRouteDirectory = relative(distDirectory, routeDirectory)
  if (
    relativeRouteDirectory === ".." ||
    relativeRouteDirectory.startsWith(`..${sep}`) ||
    relativeRouteDirectory.includes(`..${sep}`)
  ) {
    throw new Error(`Refusing to write a Pages entrypoint outside ${distDirectory}: ${href}`)
  }

  mkdirSync(routeDirectory, { recursive: true })
  copyFileSync(indexPath, resolve(routeDirectory, "index.html"))
}
