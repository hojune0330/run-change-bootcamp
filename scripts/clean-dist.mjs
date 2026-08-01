import { existsSync, readdirSync, rmdirSync, unlinkSync } from "node:fs"
import { join, resolve, sep } from "node:path"

const projectRoot = process.cwd()
const outputDirectory = process.argv[2] ?? "dist"
const allowedOutputDirectories = new Set(["dist", ".artifacts/local-preview"])

if (!allowedOutputDirectories.has(outputDirectory)) {
  throw new Error(`Refusing to clean unsupported output directory: ${outputDirectory}`)
}

const distPath = resolve(projectRoot, outputDirectory)

if (distPath === projectRoot || !distPath.startsWith(`${projectRoot}${sep}`)) {
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
