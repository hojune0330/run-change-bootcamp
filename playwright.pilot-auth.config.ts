import { defineConfig } from "@playwright/test"

const { PLAYWRIGHT_PORT: serverPort = "4186" } = process.env

// biome-ignore lint/style/noDefaultExport: Playwright discovers configuration through a default export.
export default defineConfig({
  forbidOnly: true,
  fullyParallel: false,
  outputDir: ".artifacts/playwright-pilot-auth",
  projects: [
    { name: "desktop-1280", use: { viewport: { height: 800, width: 1280 } } },
    { name: "tablet-768", use: { viewport: { height: 1024, width: 768 } } },
    { name: "mobile-375", use: { viewport: { height: 812, width: 375 } } },
  ],
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-pilot-auth" }]],
  retries: 0,
  testDir: "./e2e",
  testMatch: "pilot-auth.spec.ts",
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${serverPort}/`,
    colorScheme: "light",
    locale: "ko-KR",
    screenshot: "only-on-failure",
    trace: "on",
  },
  workers: 1,
})
