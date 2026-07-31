import { expect, type Page, test } from "@playwright/test"

async function capture(page: Page, path: string, fullPage = false) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
  })
  await page.screenshot({ path, fullPage })
}

test("participant journey persists completion and a manual record at 375px", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-375", "mobile participant journey")
  // Given
  await page.goto("/")
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.getByRole("button", { name: "참여자로 시작" }).click()
  await capture(page, testInfo.outputPath("participant-today.png"), true)

  // When
  await page.getByRole("button", { name: "과제 완료" }).click()
  await page.getByRole("link", { name: "함께" }).click()
  await capture(page, testInfo.outputPath("participant-feed-top.png"))
  await page.locator("#main-content").evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await capture(page, testInfo.outputPath("participant-feed-scrolled.png"))

  // Then
  await expect(page.getByText("편안한 달리기를 완료했어요.")).toBeVisible()
  await page.getByRole("link", { name: "기록" }).click()
  await expect(page.locator("#main-content")).toHaveJSProperty("scrollTop", 0)
  await capture(page, testInfo.outputPath("participant-record.png"), true)
  await page.getByRole("button", { name: "스크린샷 올리기" }).click()
  await page.getByLabel("운동 스크린샷").setInputFiles({
    name: "run-summary.png",
    mimeType: "image/png",
    buffer: Buffer.from("image"),
  })
  await page.getByRole("button", { name: "이미지에서 초안 만들기" }).click()
  const pendingExtraction = page.getByText("분석 대기 · 추출 연결이 필요합니다.")
  await expect(pendingExtraction).toBeVisible()
  await expect(page.getByText("5.0 km")).toHaveCount(0)
  await pendingExtraction.scrollIntoViewIfNeeded()
  await capture(page, testInfo.outputPath("participant-screenshot-pending.png"))
  await page.getByRole("button", { name: "직접 입력" }).click()
  await page.getByRole("spinbutton", { name: "측정값" }).fill("5.2")
  await page.getByRole("button", { name: "직접 기록 저장" }).click()
  await page.locator("#main-content").evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await page.getByRole("link", { name: "내 변화" }).click()
  await expect(page.locator("#main-content")).toHaveJSProperty("scrollTop", 0)
  await expect(page.getByText("5.2 km")).toBeVisible()
  await capture(page, testInfo.outputPath("participant-my-change.png"), true)
  await page.reload()
  await expect(page.getByText("김하린의 기록")).toBeVisible()
  await expect(page.getByText("5.2 km")).toBeVisible()
  const overflow = await page
    .locator("html")
    .evaluate((element) => element.scrollWidth > element.clientWidth)
  expect(overflow).toBe(false)
  await capture(page, testInfo.outputPath("participant-journey.png"), true)
})

test("coach journey confirms and persists a revised schedule at 1280px", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280", "desktop coach journey")
  // Given
  await page.goto("/")
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.getByRole("button", { name: "코치로 시작" }).click()
  await expect(page.getByText("20명 표시")).toBeVisible()
  await capture(page, testInfo.outputPath("coach-cohort.png"))
  await page.getByRole("link", { name: "과제" }).focus()
  await page.keyboard.press("Enter")
  const assignmentTitle = page.getByRole("textbox", { name: "과제명" })
  await expect(assignmentTitle).toBeFocused()
  const focusOutline = await assignmentTitle.evaluate((element) => {
    const style = window.getComputedStyle(element)
    return { style: style.outlineStyle, width: style.outlineWidth }
  })
  expect(focusOutline.style).not.toBe("none")
  expect(focusOutline.width).not.toBe("0px")
  await capture(page, testInfo.outputPath("coach-assignments-focus.png"))
  await page.getByRole("link", { name: "피드백" }).click()
  await expect(page.getByRole("button", { name: "김하린 피드백 반려" })).toBeFocused()
  await capture(page, testInfo.outputPath("coach-feedback.png"))
  await page.getByRole("link", { name: "공지" }).click()
  await expect(page.getByRole("textbox", { name: "제목" })).toBeFocused()
  await capture(page, testInfo.outputPath("coach-notices.png"))
  await page.getByRole("link", { name: "20명 현황" }).click()
  await expect(page.getByRole("searchbox", { name: "참가자 검색" })).toBeFocused()
  await page.getByRole("button", { name: "김하린 상세 보기" }).click()
  await expect(page.getByText("55 bpm")).toHaveCount(0)

  // When
  await page.getByRole("radio", { name: /1회차/ }).click()
  await page.getByRole("radio", { name: "3K" }).click()
  await page.getByRole("button", { name: "결정 저장" }).click()
  await page.getByRole("radio", { name: /2회차/ }).click()
  await page.getByRole("radio", { name: "5K" }).click()
  await page.getByRole("button", { name: "결정 변경" }).click()

  // Then
  await expect(page.getByRole("alert")).toContainText("기존 결정을 바꾸면")
  await page.getByRole("button", { name: "변경 확정" }).click()
  await expect(page.getByText("오리엔테이션 · 이지런")).toBeVisible()
  await page.reload()
  await expect(page.getByRole("radio", { name: /2회차/ })).toBeChecked()
  await expect(page.getByRole("radio", { name: "5K" })).toBeChecked()
  const overflow = await page
    .locator("html")
    .evaluate((element) => element.scrollWidth > element.clientWidth)
  expect(overflow).toBe(false)
  await capture(page, testInfo.outputPath("coach-journey.png"), true)
})
