import { expect, test } from "@playwright/test"

test("chooser keyboard traversal reaches every control in reading order", async ({ page }) => {
  // Given
  await page.goto("./")
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()

  // When
  const controls = page.locator("select, button, a, input, textarea")
  const controlCount = await controls.count()
  const expected = await controls.evaluateAll((elements) =>
    elements.map((element) => ({
      tag: element.tagName,
      text: (element.textContent ?? "").trim(),
    })),
  )
  const focusSequence: Array<{
    readonly tag: string
    readonly text: string
    readonly focusVisible: boolean
  }> = []
  for (let index = 0; index < controlCount; index += 1) {
    await page.keyboard.press("Tab")
    focusSequence.push(
      await page.evaluate(() => {
        const active = document.activeElement
        if (active === null) return { tag: "", text: "", focusVisible: false }
        const style = getComputedStyle(active)
        return {
          tag: active.tagName,
          text: (active.textContent ?? "").trim(),
          focusVisible: style.outlineStyle !== "none" && style.outlineWidth !== "0px",
        }
      }),
    )
  }

  // Then
  expect(focusSequence.map(({ tag, text }) => ({ tag, text }))).toEqual(expected)
  expect(focusSequence.every(({ focusVisible }) => focusVisible)).toBe(true)

  await page.keyboard.press("Tab")
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true)
  await page.keyboard.press("Shift+Tab")
  await expect(controls.nth(controlCount - 1)).toBeFocused()
  for (let index = controlCount - 2; index >= 0; index -= 1) {
    await page.keyboard.press("Shift+Tab")
    await expect(controls.nth(index)).toBeFocused()
  }
})
