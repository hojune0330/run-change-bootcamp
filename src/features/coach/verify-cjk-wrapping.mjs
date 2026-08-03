import { chromium } from "@playwright/test"

const TARGETS = [
  {
    name: "coach-note-decision",
    selector: ".coach-detail__note",
    phrase: "결정합니다",
  },
  {
    name: "consent-helper-retention",
    selector: ".coach-detail__helper",
    phrase: "유지합니다",
  },
  {
    name: "pain-summary-required",
    selector: ".coach-queue li:nth-child(2) > p",
    phrase: "필요합니다",
  },
  {
    name: "time-trial-week-eight",
    selector: ".coach-decision__intro",
    phrase: "8주차",
  },
]

const browser = await chromium.launch({ channel: "chrome" })
const page = await browser.newPage({ viewport: { width: 375, height: 900 } })

try {
  await page.goto("http://127.0.0.1:4173/src/features/coach/coach-preview.html")
  await page.getByRole("heading", { name: "PLUS Run 1기" }).waitFor()
  await page.evaluate(() => document.fonts.ready)

  const results = []
  for (const target of TARGETS) {
    const result = await page.locator(target.selector).evaluate((element, phrase) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
      const nodes = []
      let text = ""

      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const value = node.textContent ?? ""
        nodes.push({ node, start: text.length, end: text.length + value.length })
        text += value
      }

      const phraseStart = text.indexOf(phrase)
      if (phraseStart < 0) return { found: false, lineCount: 0, text }

      const phraseEnd = phraseStart + phrase.length
      const startNode = nodes.find((entry) => phraseStart >= entry.start && phraseStart < entry.end)
      const endNode = nodes.find((entry) => phraseEnd > entry.start && phraseEnd <= entry.end)
      if (startNode === undefined || endNode === undefined) {
        return { found: false, lineCount: 0, text }
      }

      const range = document.createRange()
      range.setStart(startNode.node, phraseStart - startNode.start)
      range.setEnd(endNode.node, phraseEnd - endNode.start)
      const lineTops = [
        ...new Set(
          Array.from(range.getClientRects(), (rect) => Math.round(rect.top * 10) / 10).filter(
            (top) => Number.isFinite(top),
          ),
        ),
      ]

      return { found: true, lineCount: lineTops.length, lineTops, text }
    }, target.phrase)

    results.push({ ...target, ...result })
  }

  console.log(JSON.stringify(results, null, 2))
  if (results.some((result) => !result.found || result.lineCount !== 1)) process.exitCode = 1
} finally {
  await browser.close()
}
