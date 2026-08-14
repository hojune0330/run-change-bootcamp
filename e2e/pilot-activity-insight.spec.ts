import { expect, type Locator, test } from "@playwright/test"
import {
  authenticateParticipant,
  type InsightScenario,
  installPilotBoundary,
} from "./pilot-activity-insight-boundary.ts"

function evidenceDir(): string {
  const { PILOT_ACTIVITY_INSIGHT_EVIDENCE_DIR: directory } = process.env
  if (directory === undefined) throw new Error("PILOT_ACTIVITY_INSIGHT_EVIDENCE_DIR is required")
  return directory
}

const SCENARIOS: readonly InsightScenario[] = [
  "ready",
  "empty",
  "revoked",
  "malformed",
  "stale_empty",
]
const { PILOT_ACTIVITY_INSIGHT_E2E } = process.env

async function expectSemanticTextGroupOnOneLine(locator: Locator, text: string) {
  const geometry = await locator.evaluate((element, semanticText) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode
      const start = node.textContent?.indexOf(semanticText) ?? -1
      if (start < 0) continue
      const range = document.createRange()
      range.setStart(node, start)
      range.setEnd(node, start + semanticText.length)
      return {
        found: true,
        lineTops: [...range.getClientRects()].map((rect) => Math.round(rect.top)),
      }
    }
    return { found: false, lineTops: [] }
  }, text)

  expect(geometry.found, `Expected to find the semantic text group: ${text}`).toBe(true)
  expect(
    new Set(geometry.lineTops).size,
    `Expected the Korean semantic text group to stay on one line: ${text}`,
  ).toBe(1)
}

test.describe("private participant activity insight", () => {
  test.skip(PILOT_ACTIVITY_INSIGHT_E2E !== "1", "requires the private pilot build")

  for (const scenario of SCENARIOS) {
    test(`renders the ${scenario} state without overflow`, async ({ page }, testInfo) => {
      const consoleErrors: string[] = []
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text())
      })
      if (testInfo.project.name === "desktop-1280-reduced-motion") {
        await page.emulateMedia({ reducedMotion: "reduce" })
      }
      const capture = await installPilotBoundary(page, scenario)
      await authenticateParticipant(page)

      if (scenario === "revoked") {
        await expect(page.getByRole("region", { name: "검토된 주간 활동 요약" })).toBeVisible()
        await page.getByRole("link", { name: "함께" }).click()
        await expect(page).toHaveURL(/\/feed$/)
        capture.revoke()
        await page.getByRole("link", { name: "오늘" }).click()
        await expect(page).toHaveURL(/\/today$/)
        await expect(page.getByRole("region", { name: "검토된 주간 활동 요약" })).toHaveCount(0)
      }

      if (scenario === "malformed" || scenario === "stale_empty") {
        await expect(page.getByRole("region", { name: "검토된 주간 활동 요약" })).toBeVisible()
        await page.getByRole("link", { name: "함께" }).click()
        await expect(page).toHaveURL(/\/feed$/)
        await page.getByRole("link", { name: "오늘" }).click()
        await expect(page).toHaveURL(/\/today$/)
        await expect(page.getByRole("region", { name: "검토된 주간 활동 요약" })).toHaveCount(0)
      }

      if (scenario === "ready") {
        const insight = page.getByRole("region", { name: "검토된 주간 활동 요약" })
        await expect(insight).toContainText("검토된 가져오기 3건")
        await expect(insight).toContainText("12.4 km")
        await expect(insight).toContainText("이번 주 활동 기록이 여러 날 확인됐어요.")
        await expect(insight).toContainText("서울 시간 (Asia/Seoul)")
        await expect(insight).toContainText("계정 동기화 데이터가 아닙니다")
        await expect(insight).not.toContainText(/Garmin|심박수|걸음 수/i)
        await expect(insight).not.toContainText(/999|99건/)
      } else if (scenario === "empty" || scenario === "stale_empty") {
        await expect(page.getByRole("heading", { name: "아직 표시할 요약이 없어요" })).toBeVisible()
      } else if (scenario === "malformed") {
        await expect(page.getByRole("alert")).toBeVisible()
      } else {
        await expect(page.getByRole("heading", { name: "활동 요약이 제거되었어요" })).toBeVisible()
      }

      if (testInfo.project.name === "mobile-375" && scenario === "ready") {
        await expectSemanticTextGroupOnOneLine(
          page.locator(".pilot-activity-insight__disclosure"),
          "제공하지 않습니다",
        )
      }
      if (testInfo.project.name === "mobile-375" && scenario === "empty") {
        await expectSemanticTextGroupOnOneLine(
          page.locator(".pilot-activity-insight__state"),
          "표시되지 않아요",
        )
      }
      if (testInfo.project.name === "mobile-375" && scenario === "malformed") {
        await expectSemanticTextGroupOnOneLine(
          page.getByRole("heading", { name: "활동 요약을 불러오지 못했어요" }),
          "불러오지 못했어요",
        )
      }
      await expect(page.locator("body")).not.toContainText(
        /Garmin|OAuth|MCP|FIT|provider_identity|raw_payload|source_row_id|182|146|377|18,200/i,
      )

      await expect(page.locator(".app-shell__header")).toBeInViewport({ ratio: 1 })
      expect(
        await page
          .locator("html")
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
      ).toBe(true)
      expect(capture.unexpected).toEqual([])
      expect(capture.activityInsightReads()).toBe(
        scenario === "malformed" || scenario === "stale_empty" ? 2 : 1,
      )
      expect(consoleErrors).toEqual([])

      if (scenario === "ready") {
        const metricItems = page.locator(".pilot-activity-insight__metrics li")
        const motion = await metricItems.first().evaluate((element) => {
          const style = getComputedStyle(element)
          return {
            animationName: style.animationName,
            opacity: style.opacity,
            transform: style.transform,
          }
        })
        if (testInfo.project.name === "desktop-1280") {
          expect(motion.animationName).toBe("pilot-activity-insight-step-in")
          await expect
            .poll(() =>
              metricItems.evaluateAll((elements) => ({
                animationsFinished: elements.every((element) =>
                  element.getAnimations().every((animation) => animation.playState === "finished"),
                ),
                opacities: elements.map((element) => getComputedStyle(element).opacity),
              })),
            )
            .toEqual({ animationsFinished: true, opacities: ["1", "1", "1"] })
        } else {
          expect(motion.animationName).toBe("none")
          expect(motion.opacity).toBe("1")
          expect(motion.transform).toBe("none")
        }
      }

      await page.screenshot({
        fullPage: true,
        path: `${evidenceDir()}/${scenario}-${testInfo.project.name}.png`,
      })
      const detailTarget =
        scenario === "ready"
          ? page.getByText(/이 요약은 의료 조언이나 건강 상태 판단을 제공하지 않습니다/)
          : scenario === "malformed"
            ? page.getByRole("alert")
            : page.getByText(
                scenario === "empty" || scenario === "stale_empty"
                  ? /데이터 처리 동의가 철회되면 요약은 표시되지 않아요/
                  : /이전 활동 요약은 이 화면에 남기지 않아요/,
              )
      await detailTarget.scrollIntoViewIfNeeded()
      await expect(detailTarget).toBeInViewport()
      const header = page.locator(".app-shell__header")
      await expect(header).toBeInViewport({ ratio: 1 })
      const headerGeometry = await header.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        const shell = document.querySelector<HTMLElement>(".app-shell")
        const main = document.querySelector<HTMLElement>(".app-shell__main")
        const mainBounds = main?.getBoundingClientRect()
        return {
          bottom: bounds.bottom,
          height: bounds.height,
          htmlScrollTop: document.documentElement.scrollTop,
          mainBottom: mainBounds?.bottom ?? -1,
          mainScrollTop: main?.scrollTop ?? -1,
          mainTop: mainBounds?.top ?? -1,
          shellScrollTop: shell?.scrollTop ?? -1,
          top: bounds.top,
          viewportHeight: window.innerHeight,
          windowScrollY: window.scrollY,
          zIndex: getComputedStyle(element).zIndex,
        }
      })
      expect(headerGeometry.top).toBeGreaterThanOrEqual(0)
      expect(headerGeometry.bottom).toBeLessThanOrEqual(headerGeometry.viewportHeight)
      expect(headerGeometry.height).toBeGreaterThanOrEqual(44)
      expect(headerGeometry.mainTop).toBeGreaterThanOrEqual(headerGeometry.bottom)
      expect(headerGeometry.shellScrollTop).toBe(0)
      expect(headerGeometry.windowScrollY).toBe(0)
      expect(headerGeometry.zIndex).toBe("1")
      testInfo.annotations.push({
        description: JSON.stringify(headerGeometry),
        type: "header-geometry",
      })
      await page.locator(".app-shell").screenshot({
        path: `${evidenceDir()}/${scenario}-detail-${testInfo.project.name}.png`,
      })
      await header.screenshot({
        path: `${evidenceDir()}/${scenario}-detail-header-${testInfo.project.name}.png`,
      })
    })
  }
})
