const ROOT_PATH = "/"

export const APP_BASE_PATH = import.meta.env.BASE_URL

function normalizeBasePath(basePath: string): string {
  const withLeadingSlash = basePath.startsWith("/") ? basePath : `/${basePath}`
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, "")
  return withoutTrailingSlash === "" ? ROOT_PATH : withoutTrailingSlash
}

function normalizeTrailingSlash(pathname: string): string {
  if (pathname === ROOT_PATH) return ROOT_PATH
  return pathname.replace(/\/+$/, "") || ROOT_PATH
}

export function toAppPath(pathname: string, basePath = APP_BASE_PATH): string {
  const normalizedPath = normalizeTrailingSlash(pathname === "" ? ROOT_PATH : pathname)
  const normalizedBasePath = normalizeBasePath(basePath)

  if (normalizedBasePath === ROOT_PATH) return normalizedPath
  if (
    normalizedPath === normalizedBasePath ||
    normalizedPath === `${normalizedBasePath}${ROOT_PATH}`
  ) {
    return ROOT_PATH
  }
  if (normalizedPath.startsWith(`${normalizedBasePath}${ROOT_PATH}`)) {
    return normalizedPath.slice(normalizedBasePath.length) || ROOT_PATH
  }
  return normalizedPath
}

export function toBrowserPath(pathname: string, basePath = APP_BASE_PATH): string {
  const normalizedPath = normalizeTrailingSlash(pathname === "" ? ROOT_PATH : pathname)
  const normalizedBasePath = normalizeBasePath(basePath)

  if (normalizedBasePath === ROOT_PATH) return normalizedPath
  if (
    normalizedPath === normalizedBasePath ||
    normalizedPath.startsWith(`${normalizedBasePath}${ROOT_PATH}`)
  ) {
    return normalizedPath
  }
  return normalizedPath === ROOT_PATH
    ? `${normalizedBasePath}${ROOT_PATH}`
    : `${normalizedBasePath}${normalizedPath}`
}
