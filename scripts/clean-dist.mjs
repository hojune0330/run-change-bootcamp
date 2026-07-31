import { existsSync, readdirSync, rmdirSync, unlinkSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

const projectRoot = process.cwd()
const distPath = resolve(projectRoot, "dist")

if (dirname(distPath) !== projectRoot) {
  throw new Error("Refusing to clean a directory outside the project root.")
}

function removeDirectory(directoryPath) {
  for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = join(directoryPath, entry.name)

    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      removeDirectory(entryPath)
    } else {
      unlinkSync(entryPath)
    }
  }

  rmdirSync(directoryPath)
}

if (existsSync(distPath)) {
  removeDirectory(distPath)
}
