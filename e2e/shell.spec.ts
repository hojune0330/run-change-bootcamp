import { expect, test } from "@playwright/test"

test("shell stays usable without horizontal overflow at its configured viewport", async ({
  page,
}, testInfo) => {
  // Given
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("./")

  // When
  const hasHorizontalOverflow = await page.locator("html").evaluate((element) => {
    return element.scrollWidth > element.clientWidth
  })

  // Then
  await expect(page.getByRole("region", { name: "데모 세션 선택" })).toBeVisible()
  expect(hasHorizontalOverflow).toBe(false)
  await page.screenshot({
    path: testInfo.outputPath("shell.png"),
    fullPage: true,
  })
})

test("authenticated participant shell uses side navigation at 768px", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "tablet-768", "tablet shell evidence")
  await page.goto("./")
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.getByRole("button", { name: "참여자로 시작" }).click()

  const layout = await page.locator(".app-shell").evaluate((shell) => {
    const navigation = shell.querySelector("nav")
    const main = shell.querySelector("main")
    if (!(navigation instanceof HTMLElement) || !(main instanceof HTMLElement)) return null
    const navigationBox = navigation.getBoundingClientRect()
    const mainBox = main.getBoundingClientRect()
    return { mainLeft: mainBox.left, navigationRight: navigationBox.right }
  })

  expect(layout).not.toBeNull()
  expect(layout?.navigationRight).toBeLessThanOrEqual(layout?.mainLeft ?? 0)
  await page.screenshot({ path: testInfo.outputPath("authenticated-shell.png") })
})

test("reloads the supported /record route without losing the app shell", async ({ page }) => {
  // Given
  await page.goto("./")
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.locator("button").first().click()

  // When
  await page.goto("./record")
  await page.reload()

  // Then
  await expect(page).toHaveURL(/\/record$/)
  await expect(page.locator(".app-shell")).toBeVisible()
})
