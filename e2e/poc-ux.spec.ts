import { expect, test } from "@playwright/test"

const ADMIN_SCREENS = [
  ["운영 개요", "관리자 운영 대시보드", "overview"],
  ["멤버", "관리자 멤버 명부", "members"],
  ["일정", "관리자 프로그램 일정", "schedule"],
  ["활동 로그", "관리자 활동 로그", "activity"],
  ["보고", "관리자 운영 보고", "reports"],
  ["설정", "관리자 프로그램 설정", "settings"],
] as const

async function resetPreview(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("./")
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
}

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page): Promise<void> {
  const overflows = await page
    .locator("html")
    .evaluate((element) => element.scrollWidth > element.clientWidth)
  expect(overflows).toBe(false)
}

test("participant and coach preview journeys preserve synthetic-data context", async ({
  page,
}, testInfo) => {
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await resetPreview(page)

  await page.getByRole("button", { name: "참여자로 시작" }).click()
  for (const label of ["오늘", "함께", "기록", "내 변화"] as const) {
    await page.getByRole("link", { name: label }).click()
    await expect(page.getByRole("heading", { level: 1, name: label })).toBeVisible()
    await expect(page.getByText("시연용 합성 데이터")).toBeVisible()
    await expectNoHorizontalOverflow(page)
  }
  await page.screenshot({ path: testInfo.outputPath("participant-change.png") })

  await page.getByRole("link", { name: "세션 바꾸기" }).click()
  await page.getByRole("button", { name: "코치로 시작" }).click()
  await expect(page.getByRole("region", { name: "코치 운영 대시보드" })).toBeVisible()
  await expect(page.getByText("시연용 합성 데이터")).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.screenshot({ path: testInfo.outputPath("coach-dashboard.png") })

  expect(consoleErrors).toEqual([])
})

test("all six admin routes are distinct, usable, and visually captured", async ({
  page,
}, testInfo) => {
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await resetPreview(page)
  await page.getByRole("button", { name: "관리자로 시작" }).click()

  for (const [navigationLabel, screenLabel, artifactName] of ADMIN_SCREENS) {
    const navigationLink = page.getByRole("link", { name: navigationLabel })
    await navigationLink.click()
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
    await page.screenshot({ path: testInfo.outputPath(`admin-${artifactName}.png`) })
  }

  expect(consoleErrors).toEqual([])
})
