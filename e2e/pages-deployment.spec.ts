import { expect, test } from "@playwright/test"

const readEnvironment = (name: string) => process.env[name]

test("serves and resolves a direct route below the GitHub Pages base path", async ({ page }) => {
  test.skip(
    readEnvironment("PAGES_STATIC_SERVER") !== "1" && readEnvironment("PAGES_PREVIEW") !== "1",
    "GitHub Pages smoke runs only with an explicit Pages server",
  )
  const isStaticServer = readEnvironment("PAGES_STATIC_SERVER") === "1"

  // Given
  const fallbackResponse = await page.request.get("/run-change-bootcamp/record")

  // When
  await page.goto("/run-change-bootcamp/record")
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.locator("button").first().click()
  await page.goto("/run-change-bootcamp/record")

  // Then
  expect(fallbackResponse.status()).toBe(isStaticServer ? 404 : 200)
  expect(await fallbackResponse.text()).toContain('id="root"')
  await expect(page).toHaveURL(/\/run-change-bootcamp\/record$/)
  await expect(page.locator(".app-shell")).toBeVisible()
  await expect(page.locator('script[src^="/run-change-bootcamp/"]')).toHaveCount(2)
})

test("compresses and revalidates the critical JavaScript asset on the Pages static host", async ({
  request,
}) => {
  test.skip(readEnvironment("PAGES_STATIC_SERVER") !== "1", "Static-host fidelity check")

  // Given
  const documentResponse = await request.get("/run-change-bootcamp/")
  const documentBody = await documentResponse.text()
  const scriptSource = documentBody.match(/src="([^"]+\.js)"/)?.[1] ?? ""
  expect(scriptSource).toMatch(/^\/run-change-bootcamp\/assets\/.+\.js$/)

  // When
  const scriptResponse = await request.get(scriptSource, {
    headers: { "Accept-Encoding": "gzip" },
  })

  // Then
  const responseHeaders = scriptResponse.headers()
  const { etag: entityTag } = responseHeaders
  expect(responseHeaders["content-encoding"]).toBe("gzip")
  expect(entityTag).toMatch(/^W\/".+"$/)

  const revalidatedResponse = await request.get(scriptSource, {
    headers: {
      "Accept-Encoding": "gzip",
      "If-None-Match": entityTag ?? "",
    },
  })
  expect(revalidatedResponse.status()).toBe(304)
})
