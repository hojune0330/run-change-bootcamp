import { expect, test } from "@playwright/test"
import { z } from "zod"

const pagesBasePath = "/run-change-bootcamp/"
const PagesAssetPathSchema = z.string().regex(/^\/run-change-bootcamp\/.+/)
const ManifestSchema = z.object({
  icons: z.array(z.object({ src: z.string() })),
  scope: z.literal(pagesBasePath),
  start_url: z.literal(pagesBasePath),
})

test("serves the app for a supported direct /record route after an actual static 404", async ({
  page,
}) => {
  // Given
  const fallbackResponse = await page.request.get("./record")

  // When
  await page.goto("./record")
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.locator("button").first().click()
  await page.goto("./record")

  // Then
  expect(fallbackResponse.status()).toBe(404)
  expect(await fallbackResponse.text()).toContain('id="root"')
  await expect(page).toHaveURL(/\/run-change-bootcamp\/record$/)
  await expect(page.locator(".app-shell")).toBeVisible()

  const scriptSource = PagesAssetPathSchema.parse(
    await page.locator('script[type="module"][src]').first().getAttribute("src"),
  )
  const scriptResponse = await page.request.get(scriptSource)
  expect(scriptResponse.status()).toBe(200)
  expect(scriptResponse.headers()["content-type"]).toContain("text/javascript")
  expect(await scriptResponse.text()).not.toContain("<!doctype html>")
})

test("registers Pages-scoped PWA resources and serves emitted metadata", async ({ page }) => {
  // Given
  await page.goto("./")

  // When
  const manifestResponse = await page.request.get(`${pagesBasePath}manifest.webmanifest`)
  const manifest = ManifestSchema.parse(await manifestResponse.json())
  const registration = await page.evaluate(async () => {
    const readyRegistration = await navigator.serviceWorker.ready
    return {
      activeScript: readyRegistration.active?.scriptURL ?? "",
      scope: readyRegistration.scope,
    }
  })
  await page.reload()
  const controllerScript = await page.evaluate(
    () => navigator.serviceWorker.controller?.scriptURL ?? "",
  )

  // Then
  expect(manifestResponse.status()).toBe(200)
  expect(manifest.icons.every(({ src }) => src.startsWith(pagesBasePath))).toBe(true)
  expect(new URL(registration.scope).pathname).toBe(pagesBasePath)
  expect(new URL(registration.activeScript).pathname).toBe(`${pagesBasePath}sw.js`)
  expect(new URL(controllerScript).pathname).toBe(`${pagesBasePath}sw.js`)

  const iconPath = PagesAssetPathSchema.parse(
    await page.locator('link[rel="icon"]').getAttribute("href"),
  )
  const iconResponse = await page.request.get(iconPath)
  expect(iconResponse.status()).toBe(200)
  expect(iconResponse.headers()["content-type"]).toContain("image/svg+xml")

  const robotsResponse = await page.request.get(`${pagesBasePath}robots.txt`)
  expect(robotsResponse.status()).toBe(200)
  expect(robotsResponse.headers()["content-type"]).toContain("text/plain")
})

test("varies compressed assets by content encoding and revalidates each representation", async ({
  request,
}) => {
  // Given
  const documentResponse = await request.get(pagesBasePath)
  const documentBody = await documentResponse.text()
  const scriptSource = PagesAssetPathSchema.parse(documentBody.match(/src="([^"]+\.js)"/)?.[1])

  // When
  const gzipResponse = await request.get(scriptSource, {
    headers: { "Accept-Encoding": "gzip" },
  })
  const identityResponse = await request.get(scriptSource, {
    headers: { "Accept-Encoding": "identity" },
  })

  // Then
  const gzipHeaders = gzipResponse.headers()
  const identityHeaders = identityResponse.headers()
  const gzipTag = z.string().parse(gzipHeaders["etag"])
  const identityTag = z.string().parse(identityHeaders["etag"])
  expect(gzipHeaders["content-encoding"]).toBe("gzip")
  expect(gzipHeaders["vary"]).toBe("Accept-Encoding")
  expect(identityHeaders["content-encoding"]).toBeUndefined()
  expect(identityHeaders["vary"]).toBe("Accept-Encoding")
  expect(gzipTag).not.toBe(identityTag)

  const wrongRepresentation = await request.get(scriptSource, {
    headers: { "Accept-Encoding": "identity", "If-None-Match": gzipTag },
  })
  const revalidatedIdentity = await request.get(scriptSource, {
    headers: { "Accept-Encoding": "identity", "If-None-Match": identityTag },
  })
  expect(wrongRepresentation.status()).toBe(200)
  expect(revalidatedIdentity.status()).toBe(304)
})

const rejectedArtifactPaths = [
  ["an origin-root artifact", "/package.json"],
  ["a sibling base prefix", "/run-change-bootcamp-archive/index.html"],
  ["an encoded parent traversal", "/run-change-bootcamp/%2e%2e/package.json"],
] as const

for (const [scenario, artifactPath] of rejectedArtifactPaths) {
  test(`rejects ${scenario} outside the Pages artifact base`, async ({ request }) => {
    // Given
    const requestHeaders = { "Accept-Encoding": "identity" }

    // When
    const response = await request.get(artifactPath, { headers: requestHeaders })

    // Then
    expect(response.status()).toBe(404)
    expect(response.headers()["content-type"]).toContain("text/plain")
    expect(await response.text()).toBe("Not Found")
  })
}
