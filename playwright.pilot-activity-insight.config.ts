import { defineConfig } from "@playwright/test"

const { PLAYWRIGHT_PORT: serverPort = "4191" } = process.env
const serverOrigin = `http://127.0.0.1:${serverPort}`

// biome-ignore lint/style/noDefaultExport: Playwright discovers configuration through a default export.
export default defineConfig({
  forbidOnly: true,
  fullyParallel: false,
  outputDir: ".artifacts/playwright-pilot-activity-insight",
  projects: [
    { name: "mobile-375", use: { viewport: { height: 812, width: 375 } } },
    { name: "tablet-768", use: { viewport: { height: 1024, width: 768 } } },
    { name: "desktop-1280", use: { viewport: { height: 800, width: 1280 } } },
    {
      name: "desktop-1280-reduced-motion",
      use: { viewport: { height: 800, width: 1280 } },
    },
  ],
  reporter: [["list"]],
  retries: 0,
  testDir: "./e2e",
  testMatch: "pilot-activity-insight.spec.ts",
  timeout: 30_000,
  use: {
    baseURL: `${serverOrigin}/`,
    colorScheme: "light",
    locale: "ko-KR",
    screenshot: "only-on-failure",
    trace: "on",
  },
  webServer: {
    command: `pnpm preview:local --host 127.0.0.1 --port ${serverPort}`,
    reuseExistingServer: false,
    url: `${serverOrigin}/`,
  },
  workers: 1,
})
