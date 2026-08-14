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
  await expect(page.getByRole("region", { name: "미리 볼 역할을 선택하세요" })).toBeVisible()
  expect(hasHorizontalOverflow).toBe(false)
  await page.screenshot({
    path: testInfo.outputPath("shell.png"),
    fullPage: true,
  })
})

test("shell keeps the main region as the only vertical scroll owner at 200% CSS zoom", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-375", "mobile zoom scroll ownership")

  await page.goto("./")
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.locator(".demo-entry__actions button").nth(0).click()
  await page.locator(".app-shell").waitFor()

  await page.evaluate(() => {
    document.documentElement.style.zoom = "2"
  })

  const metrics = await page.locator("body").evaluate(() => {
    const html = document.documentElement
    const body = document.body
    const main = document.querySelector(".app-shell__main")
    if (!(main instanceof HTMLElement)) throw new Error("app shell main is missing")

    html.scrollTop = 100
    body.scrollTop = 100
    main.scrollTop = 100

    return {
      htmlClientHeight: html.clientHeight,
      htmlScrollHeight: html.scrollHeight,
      htmlScrollTop: html.scrollTop,
      bodyClientHeight: body.clientHeight,
      bodyScrollHeight: body.scrollHeight,
      bodyScrollTop: body.scrollTop,
      mainClientHeight: main.clientHeight,
      mainScrollHeight: main.scrollHeight,
      mainScrollTop: main.scrollTop,
    }
  })

  expect(metrics.htmlScrollHeight).toBe(metrics.htmlClientHeight)
  expect(metrics.bodyScrollHeight).toBe(metrics.bodyClientHeight)
  expect(metrics.htmlScrollTop).toBe(0)
  expect(metrics.bodyScrollTop).toBe(0)
  expect(metrics.mainScrollHeight).toBeGreaterThan(metrics.mainClientHeight)
  expect(metrics.mainScrollTop).toBeGreaterThan(0)
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
  await expect(page).toHaveURL(/\/record\/?$/)
  await expect(page.locator(".app-shell")).toBeVisible()
})
