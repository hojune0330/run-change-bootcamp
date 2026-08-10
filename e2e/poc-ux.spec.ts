import { expect, test } from "@playwright/test"

type Page = import("@playwright/test").Page
type Locator = import("@playwright/test").Locator

const ADMIN_SCREENS = [
  ["운영 개요", "관리자 운영 대시보드", "overview"],
  ["멤버", "관리자 멤버 명부", "members"],
  ["일정", "관리자 프로그램 일정", "schedule"],
  ["활동 로그", "관리자 활동 로그", "activity"],
  ["보고", "관리자 운영 보고", "reports"],
  ["설정", "관리자 프로그램 설정", "settings"],
] as const

const ADMIN_UNBROKEN_PHRASES = [
  "결정하면",
  "한 화면에서 확인합니다.",
  "멤버가 요청하면",
  "(참여자 5명 미만)",
  "건강 공유 현황",
] as const

async function resetPreview(page: Page): Promise<void> {
  await page.goto("./")
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflows = await page
    .locator("html")
    .evaluate((element) => element.scrollWidth > element.clientWidth)
  expect(overflows).toBe(false)
}

async function expectTableContentReachable(page: Page): Promise<void> {
  const viewport = page.viewportSize()
  for (const region of await page.locator(".admin-activity__table-wrap").all()) {
    const state = await region.evaluate((element) => {
      const lastCell = element.querySelector("tbody tr:last-child > :last-child")
      const regionRect = element.getBoundingClientRect()
      const cellRect = lastCell?.getBoundingClientRect()
      return {
        contentFits:
          cellRect === undefined ||
          (cellRect.left >= regionRect.left - 1 && cellRect.right <= regionRect.right + 1),
        scrollWidth: element.scrollWidth,
        width: element.clientWidth,
      }
    })

    if (viewport !== null && viewport.width < 1024) {
      expect(state.scrollWidth).toBeLessThanOrEqual(state.width + 1)
      expect(state.contentFits).toBe(true)
    }
  }
}

async function expectPhrasesOnOneLine(locator: Locator, phrases: readonly string[]): Promise<void> {
  const measured = await locator.evaluate((element, expectedPhrases) => {
    const text = (element.textContent ?? "").replaceAll("\u00a0", " ")
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    const nodes: { end: number; node: Text; start: number }[] = []
    let cursor = 0
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!(node instanceof Text)) continue
      nodes.push({ end: cursor + node.length, node, start: cursor })
      cursor += node.length
    }

    return expectedPhrases.map((phrase) => {
      const normalizedPhrase = phrase.replaceAll("\u00a0", " ")
      const start = text.indexOf(normalizedPhrase)
      const end = start + normalizedPhrase.length - 1
      const startNode = nodes.find((node) => start >= node.start && start < node.end)
      const endNode = nodes.find((node) => end >= node.start && end < node.end)
      if (start < 0 || startNode === undefined || endNode === undefined) {
        return { lineCount: 0, phrase }
      }
      const range = document.createRange()
      range.setStart(startNode.node, start - startNode.start)
      range.setEnd(endNode.node, end - endNode.start + 1)
      const lines = new Set(
        Array.from(range.getClientRects(), (rect) => Math.round(rect.top * 10) / 10),
      )
      return { lineCount: lines.size, phrase }
    })
  }, phrases)

  expect(measured).toEqual(phrases.map((phrase) => ({ lineCount: 1, phrase })))
}

async function expectAdminCopyWithoutOrphans(page: Page): Promise<void> {
  const eyebrow = page.locator(".admin-dashboard__eyebrow")
  const eyebrowText = (await eyebrow.textContent()) ?? ""
  const dateTokens = eyebrowText.match(/\d{1,2}월[ \u00a0]\d{1,2}일/g) ?? []
  await expectPhrasesOnOneLine(eyebrow, dateTokens)
  const rangeEnd = eyebrowText.match(/–(?:\u2060)?[ \u00a0]\d{1,2}월[ \u00a0]\d{1,2}일/)?.[0]
  if (rangeEnd !== undefined) {
    await expectPhrasesOnOneLine(eyebrow, [rangeEnd])
  }

  const description = page.locator(".admin-dashboard__header > div > span")
  if ((await description.textContent())?.includes("한 화면에서 확인합니다.")) {
    await expectPhrasesOnOneLine(description, ["한 화면에서 확인합니다."])
  }

  const dashboard = page.locator(".admin-dashboard")
  const dashboardText = ((await dashboard.textContent()) ?? "").replaceAll("\u00a0", " ")
  const presentPhrases = ADMIN_UNBROKEN_PHRASES.filter((phrase) => dashboardText.includes(phrase))
  await expectPhrasesOnOneLine(dashboard, presentPhrases)
}

function observeRuntimeErrors(page: Page): string[] {
  const errors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console:${message.text()}`)
  })
  page.on("pageerror", (error) => errors.push(`pageerror:${error.message}`))
  page.on("requestfailed", (request) =>
    errors.push(`requestfailed:${request.url()}:${request.failure()?.errorText ?? "unknown"}`),
  )
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`response:${response.status()}:${response.url()}`)
  })
  return errors
}

async function resetCaptureViewport(page: Page): Promise<void> {
  const geometry = await page.evaluate(() => {
    window.scrollTo({ left: 0, top: 0 })
    document.querySelector<HTMLElement>(".app-shell")?.scrollTo({ left: 0, top: 0 })
    document.querySelector<HTMLElement>(".app-shell__main")?.scrollTo({ left: 0, top: 0 })

    const header = document.querySelector<HTMLElement>(".app-shell__header")
    const provenance = document.querySelector<HTMLElement>("[data-demo-provenance]")
    const headerRect = header?.getBoundingClientRect()
    const provenanceRect = provenance?.getBoundingClientRect()
    return {
      headerBottom: headerRect?.bottom ?? -1,
      headerTop: headerRect?.top ?? -1,
      provenanceBottom: provenanceRect?.bottom ?? -1,
      provenanceTop: provenanceRect?.top ?? -1,
      viewportHeight: window.innerHeight,
    }
  })

  expect(geometry.headerTop).toBeGreaterThanOrEqual(0)
  expect(geometry.headerBottom).toBeLessThanOrEqual(geometry.viewportHeight)
  expect(geometry.provenanceTop).toBeGreaterThanOrEqual(geometry.headerTop)
  expect(geometry.provenanceBottom).toBeLessThanOrEqual(geometry.headerBottom)
}

test("participant and coach preview journeys preserve synthetic-data context", async ({
  page,
}, testInfo) => {
  const runtimeErrors = observeRuntimeErrors(page)
  await page.emulateMedia({ reducedMotion: "reduce" })
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
    true,
  )
  await resetPreview(page)

  await page.getByRole("button", { name: "참여자로 시작" }).click()
  for (const label of ["오늘", "함께", "기록", "내 변화"] as const) {
    await page.getByRole("link", { name: label }).click()
    await expect(page.getByRole("heading", { level: 1, name: label })).toBeVisible()
    await expect(page.getByText("시연용 합성 데이터")).toBeVisible()
    await expectNoHorizontalOverflow(page)
    if (label === "기록") {
      await expect(page.getByText("8월 31일")).toBeVisible()
      await expectPhrasesOnOneLine(page.locator(".participant-screen"), ["초안으로 만들어요."])
      await resetCaptureViewport(page)
      await page.screenshot({ path: testInfo.outputPath("participant-record.png") })
    }
  }
  await expect(page.getByText("전체 과제 기준", { exact: true })).toBeVisible()
  await expect(page.getByText("시드 기준", { exact: true })).toHaveCount(0)
  await resetCaptureViewport(page)
  await page.screenshot({ path: testInfo.outputPath("participant-change.png") })

  await page.getByRole("link", { name: "세션 바꾸기" }).click()
  await page.getByRole("button", { name: "코치로 시작" }).click()
  await expect(page.getByRole("region", { name: "코치 운영 대시보드" })).toBeVisible()
  await expect(page.getByText("시연용 합성 데이터")).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await expectPhrasesOnOneLine(page.locator(".coach-dashboard"), ["한곳에서 확인합니다."])
  await resetCaptureViewport(page)
  await page.screenshot({ path: testInfo.outputPath("coach-dashboard.png") })

  expect(runtimeErrors).toEqual([])
})

test("all six admin routes are distinct, usable, and visually captured", async ({
  page,
}, testInfo) => {
  const runtimeErrors = observeRuntimeErrors(page)
  await page.emulateMedia({ reducedMotion: "reduce" })
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
    true,
  )
  await resetPreview(page)
  await page.getByRole("button", { name: "관리자로 시작" }).click()

  for (const [navigationLabel, screenLabel, artifactName] of ADMIN_SCREENS) {
    const navigationLink = page.getByRole("link", { name: navigationLabel })
    await navigationLink.focus()
    await page.keyboard.press("Enter")
    await expect(page.getByRole("region", { name: screenLabel })).toBeVisible()
    await expect(navigationLink).toHaveAttribute("aria-current", "page")
    await expect(page.getByText("시연용 합성 데이터")).toBeVisible()
    await expect(page.locator(".app-shell__header")).toBeInViewport()
    for (const [adminNavigationLabel] of ADMIN_SCREENS) {
      await expect(page.getByRole("link", { name: adminNavigationLabel })).toBeInViewport()
    }
    if (artifactName === "overview") {
      await expect(navigationLink).toBeFocused()
    } else {
      await expect(page.locator("#main-content")).toBeFocused()
    }
    await expectNoHorizontalOverflow(page)
    await expectAdminCopyWithoutOrphans(page)
    if (artifactName === "activity") {
      await expectPhrasesOnOneLine(page.locator(".admin-activity"), ["발행·승인·결정하면"])
    }
    await expectTableContentReachable(page)
    await resetCaptureViewport(page)
    await page.screenshot({ path: testInfo.outputPath(`admin-${artifactName}.png`) })
  }

  expect(runtimeErrors).toEqual([])
})
