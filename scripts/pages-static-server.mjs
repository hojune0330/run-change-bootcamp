import { createReadStream, existsSync, statSync } from "node:fs"
import { createServer } from "node:http"
import { extname, resolve } from "node:path"
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
  ".webmanifest": "application/manifest+json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
}
const compressibleExtensions = new Set([".css", ".html", ".js", ".json", ".svg", ".webmanifest"])

function distPathFor(pathname) {
  if (pathname === "/" || pathname === pagesBasePath) return resolve(distRoot, "index.html")
  const artifactPath = pathname
  const relativePath = artifactPath.startsWith(pagesBasePath)
    ? artifactPath.slice(pagesBasePath.length - 1)
    : artifactPath
  const targetPath = resolve(distRoot, `.${relativePath}`)
  if (!targetPath.startsWith(distRoot)) return null
  return targetPath
}

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://${host}:${port}`)
  const targetPath = distPathFor(requestUrl.pathname)
  const fallbackPath = resolve(distRoot, "404.html")
  const filePath =
    targetPath !== null && existsSync(targetPath) && statSync(targetPath).isFile()
      ? targetPath
      : fallbackPath
  const extension = extname(filePath)
  const fileStats = statSync(filePath)
  const entityTag = `W/"${fileStats.size}-${Math.trunc(fileStats.mtimeMs)}"`

  response.statusCode = filePath === fallbackPath ? 404 : 200
  response.setHeader("Content-Type", contentTypes[extension] ?? "application/octet-stream")
  response.setHeader("Cache-Control", "no-cache")
  response.setHeader("ETag", entityTag)
  if (response.statusCode === 200 && request.headers["if-none-match"] === entityTag) {
    response.statusCode = 304
    response.end()
    return
  }
  if (
    compressibleExtensions.has(extension) &&
    request.headers["accept-encoding"]?.includes("gzip")
  ) {
    response.setHeader("Content-Encoding", "gzip")
    response.setHeader("Vary", "Accept-Encoding")
    createReadStream(filePath).pipe(createGzip()).pipe(response)
    return
  }
  createReadStream(filePath).pipe(response)
})

server.listen(Number(port), host)
