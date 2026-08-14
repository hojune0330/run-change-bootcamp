import { expect, test } from "@playwright/test"

test("desktop weekly insight settles at the end of participant scrolling", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280", "desktop motion insight")

  // Given
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto("./")
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.getByRole("button", { name: "참여자로 시작" }).click()
  const firstChapter = page.locator("[data-motion-insight-chapter]").first()
  await expect(firstChapter).toHaveCSS("opacity", "1")
  await expect
    .poll(() =>
      firstChapter.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m42),
    )
    .toBeGreaterThan(0)

  // When
  await page.locator("#main-content").evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })

  // Then
  await expect
    .poll(() =>
      firstChapter.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m42),
    )
    .toBeLessThan(0.1)
})

test("desktop weekly insight stays readable with reduced motion", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280", "desktop reduced-motion insight")

  // Given
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("./")
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.getByRole("button", { name: "참여자로 시작" }).click()

  // Then
  const chapters = page.locator("[data-motion-insight-chapter]")
  await expect(chapters).toHaveCount(3)
  await expect
    .poll(() =>
      chapters.evaluateAll((elements) =>
        elements.map((element) => {
          const style = getComputedStyle(element)
          return { opacity: style.opacity, transform: style.transform }
        }),
      ),
    )
    .toEqual([
      { opacity: "1", transform: "none" },
      { opacity: "1", transform: "none" },
      { opacity: "1", transform: "none" },
    ])
})

test("weekly insight stays readable below the motion breakpoint", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "tablet-768", "tablet motion insight")

  // Given
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto("./")
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.getByRole("button", { name: "참여자로 시작" }).click()

  // Then
  const chapters = page.locator("[data-motion-insight-chapter]")
  await expect(chapters).toHaveCount(3)
  await expect
    .poll(() =>
      chapters.evaluateAll((elements) =>
        elements.map((element) => {
          const style = getComputedStyle(element)
          return { opacity: style.opacity, transform: style.transform }
        }),
      ),
    )
    .toEqual([
      { opacity: "1", transform: "none" },
      { opacity: "1", transform: "none" },
      { opacity: "1", transform: "none" },
    ])
})
