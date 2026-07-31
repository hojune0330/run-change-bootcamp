import { copyFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

const projectRoot = process.cwd()
const distDirectory = resolve(projectRoot, "dist")
const indexPath = resolve(distDirectory, "index.html")
const fallbackPath = resolve(distDirectory, "404.html")

if (!existsSync(indexPath)) {
  throw new Error(`Cannot create the Pages fallback because ${indexPath} does not exist.`)
}

copyFileSync(indexPath, fallbackPath)
