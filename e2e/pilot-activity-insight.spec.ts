import { expect, test } from "@playwright/test"
import {
  authenticateParticipant,
  type InsightScenario,
  installPilotBoundary,
} from "./pilot-activity-insight-boundary.ts"

function evidenceDir(): string {
  const directory = process.env["PILOT_ACTIVITY_INSIGHT_EVIDENCE_DIR"]
  if (directory === undefined) throw new Error("PILOT_ACTIVITY_INSIGHT_EVIDENCE_DIR is required")
  return directory
}

const SCENARIOS: readonly InsightScenario[] = ["ready", "empty", "revoked"]

test.describe("private participant activity insight", () => {
  test.skip(process.env["PILOT_ACTIVITY_INSIGHT_E2E"] !== "1", "requires the private pilot build")

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

      if (scenario === "ready") {
        const insight = page.getByRole("region", { name: "검토된 주간 활동 요약" })
        await expect(insight).toContainText("검토된 가져오기 3건")
        await expect(insight).toContainText("12.4 km")
        await expect(insight).toContainText("이번 주 활동 기록이 여러 날 확인됐어요.")
        await expect(insight).toContainText("서울 시간 (Asia/Seoul)")
        await expect(insight).toContainText("계정 동기화 데이터가 아닙니다")
        await expect(insight).not.toContainText(/Garmin|심박수|걸음 수/i)
        await expect(insight).not.toContainText(/999|99건/)
      } else if (scenario === "empty") {
        await expect(page.getByRole("heading", { name: "아직 표시할 요약이 없어요" })).toBeVisible()
      } else {
        await expect(page.getByRole("heading", { name: "활동 요약이 제거되었어요" })).toBeVisible()
      }

      await expect(page.locator(".app-shell__header")).toBeInViewport({ ratio: 1 })
      expect(
        await page
          .locator("html")
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
      ).toBe(true)
      expect(capture.unexpected).toEqual([])
      expect(capture.activityInsightReads()).toBe(1)
      expect(consoleErrors).toEqual([])

      if (scenario === "ready") {
        const motion = await page
          .locator(".pilot-activity-insight__metrics li")
          .first()
          .evaluate((element) => {
            const style = getComputedStyle(element)
            return {
              animationName: style.animationName,
              opacity: style.opacity,
              transform: style.transform,
            }
          })
        if (testInfo.project.name !== "desktop-1280") {
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
          : page.getByText(
              scenario === "empty"
                ? /데이터 처리 동의가 철회되면 요약은 표시되지 않아요/
                : /이전 활동 요약은 이 화면에 남기지 않아요/,
            )
      await detailTarget.scrollIntoViewIfNeeded()
      await expect(detailTarget).toBeInViewport()
      await expect(page.locator(".app-shell__header")).toBeInViewport({ ratio: 1 })
      await page.screenshot({
        path: `${evidenceDir()}/${scenario}-detail-${testInfo.project.name}.png`,
      })
    })
  }
})
