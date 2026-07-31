import { chromium } from "@playwright/test"

const browser = await chromium.launch({ channel: "chrome" })
const results = []

for (const width of [375, 768, 1280]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  await page.goto("http://127.0.0.1:4173/src/features/coach/coach-preview.html")
  await page.getByRole("heading", { name: "RUN CHANGE 1기" }).waitFor()
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    rosterScrollWidth: document.querySelector(".coach-roster__table-region")?.scrollWidth ?? 0,
    rosterClientWidth: document.querySelector(".coach-roster__table-region")?.clientWidth ?? 0,
    title: document.title,
  }))
  const path = `../.omo/evidence/coach-t4-20260731/coach-${width}.png`
  await page.screenshot({ fullPage: true, path })
  results.push({
    width,
    ...metrics,
    overflow: metrics.scrollWidth > metrics.clientWidth,
    rosterOverflow: metrics.rosterScrollWidth > metrics.rosterClientWidth,
    path,
  })
  await page.close()
}

await browser.close()
console.log(JSON.stringify(results, null, 2))
