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

test("chooser keeps the exact 세션 substring on one line at 200% CSS zoom", async ({ page }) => {
  // Given
  await page.goto("./")
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()

  // When
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2"
  })
  const sessionRects = await page.locator("#demo-session-title").evaluate((heading) => {
    const phrase = "세션"
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT)
    const textNode = walker.nextNode()
    if (!(textNode instanceof Text)) throw new Error("chooser heading text is missing")

    const phraseStart = textNode.data.indexOf(phrase)
    if (phraseStart < 0) throw new Error("chooser heading does not contain the target substring")

    const range = document.createRange()
    range.setStart(textNode, phraseStart)
    range.setEnd(textNode, phraseStart + phrase.length)
    return Array.from(range.getClientRects(), ({ x, y, width, height }) => ({
      x,
      y,
      width,
      height,
    }))
  })

  // Then
  expect(sessionRects).toHaveLength(1)
})
