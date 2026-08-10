import { createReadStream, existsSync, statSync } from "node:fs"
import { createServer } from "node:http"
import { extname, isAbsolute, relative, resolve, sep } from "node:path"
import { createGzip } from "node:zlib"

const distRoot = resolve(process.cwd(), "dist")
const pagesBasePath = "/run-change-bootcamp/"
const hostArgumentIndex = process.argv.indexOf("--host")
const portArgumentIndex = process.argv.indexOf("--port")
const host = hostArgumentIndex === -1 ? "127.0.0.1" : process.argv[hostArgumentIndex + 1]
const port = portArgumentIndex === -1 ? "4173" : process.argv[portArgumentIndex + 1]

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
}
const compressibleExtensions = new Set([".css", ".html", ".js", ".json", ".svg", ".webmanifest"])

function distPathFor(pathname) {
  if (!pathname.startsWith(pagesBasePath)) return null
  const artifactPath = pathname.slice(pagesBasePath.length)
  const targetPath = resolve(distRoot, artifactPath || "index.html")
  const relativeTarget = relative(distRoot, targetPath)
  if (
    relativeTarget === ".." ||
    relativeTarget.startsWith(`..${sep}`) ||
    isAbsolute(relativeTarget)
  ) {
    return null
  }
  return targetPath
}

function servePathFor(targetPath, fallbackPath) {
  if (!existsSync(targetPath)) return fallbackPath
  const targetStats = statSync(targetPath)
  if (targetStats.isFile()) return targetPath
  if (!targetStats.isDirectory()) return fallbackPath

  const directoryIndexPath = resolve(targetPath, "index.html")
  return existsSync(directoryIndexPath) && statSync(directoryIndexPath).isFile()
    ? directoryIndexPath
    : fallbackPath
}

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://${host}:${port}`)
  const targetPath = distPathFor(requestUrl.pathname)
  if (targetPath === null) {
    response.statusCode = 404
    response.setHeader("Content-Type", "text/plain; charset=utf-8")
    response.setHeader("Cache-Control", "no-cache")
    response.end("Not Found")
    return
  }
  const fallbackPath = resolve(distRoot, "404.html")
  const filePath = servePathFor(targetPath, fallbackPath)
  const extension = extname(filePath)
  const fileStats = statSync(filePath)
  const isCompressible = compressibleExtensions.has(extension)
  const usesGzip = isCompressible && request.headers["accept-encoding"]?.includes("gzip") === true
  const representation = usesGzip ? "gzip" : "identity"
  const entityTag = `W/"${fileStats.size}-${Math.trunc(fileStats.mtimeMs)}-${representation}"`

  response.statusCode = filePath === fallbackPath ? 404 : 200
  response.setHeader("Content-Type", contentTypes[extension] ?? "application/octet-stream")
  response.setHeader("Cache-Control", "no-cache")
  response.setHeader("ETag", entityTag)
  if (isCompressible) response.setHeader("Vary", "Accept-Encoding")
  if (response.statusCode === 200 && request.headers["if-none-match"] === entityTag) {
    response.statusCode = 304
    response.end()
    return
  }
  if (usesGzip) {
    response.setHeader("Content-Encoding", "gzip")
    createReadStream(filePath).pipe(createGzip()).pipe(response)
    return
  }
  createReadStream(filePath).pipe(response)
})

server.listen(Number(port), host)
