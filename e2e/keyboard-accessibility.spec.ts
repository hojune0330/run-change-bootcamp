import { expect, test } from "@playwright/test"

test("chooser keyboard traversal reaches every control in reading order", async ({ page }) => {
  // Given
  await page.goto("./")
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await expect(page.locator("#demo-session-title")).toBeVisible()

  // When
  const controls = page.locator("select, button, a, input, textarea")
  const controlCount = await controls.count()
  expect(controlCount).toBeGreaterThan(0)
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

  await controls.nth(controlCount - 1).focus()
  for (let index = controlCount - 2; index >= 0; index -= 1) {
    await page.keyboard.press("Shift+Tab")
    await expect(controls.nth(index)).toBeFocused()
  }
})

test("chooser keeps each heading word readable at 200% CSS zoom", async ({ page }) => {
  // Given
  await page.goto("./")
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()

  // When
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2"
  })
  const wordLineCounts = await page.locator("#demo-session-title").evaluate((heading) => {
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT)
    const textNodes: Array<{ readonly end: number; readonly node: Text; readonly start: number }> =
      []
    let offset = 0
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!(node instanceof Text)) continue
      textNodes.push({ node, start: offset, end: offset + node.data.length })
      offset += node.data.length
    }

    const text = textNodes.map(({ node }) => node.data).join("")
    return [...text.matchAll(/\S+/g)].map((match) => {
      const start = match.index ?? 0
      const end = start + match[0].length
      const startNode = textNodes.find(
        ({ end: nodeEnd, start: nodeStart }) => start >= nodeStart && start < nodeEnd,
      )
      const endNode = textNodes.find(
        ({ end: nodeEnd, start: nodeStart }) => end > nodeStart && end <= nodeEnd,
      )
      if (startNode === undefined || endNode === undefined) {
        throw new Error("chooser heading word boundaries are missing")
      }

      const range = document.createRange()
      range.setStart(startNode.node, start - startNode.start)
      range.setEnd(endNode.node, end - endNode.start)
      return new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top * 10) / 10))
        .size
    })
  })

  // Then
  expect(wordLineCounts.length).toBeGreaterThan(0)
  expect(wordLineCounts.every((lineCount) => lineCount === 1)).toBe(true)
})
