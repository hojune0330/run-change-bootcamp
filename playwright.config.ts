import { defineConfig } from "@playwright/test"

const serverPort = process.env["PLAYWRIGHT_PORT"] ?? "4173"
const serverOrigin = `http://127.0.0.1:${serverPort}`
const pagesBasePath = "/run-change-bootcamp/"

export const sharedPlaywrightConfig = defineConfig({
  testDir: "./e2e",
  outputDir: ".artifacts/playwright",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    colorScheme: "light",
    locale: "ko-KR",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-375",
      use: { viewport: { width: 375, height: 812 } },
    },
    {
      name: "tablet-768",
      use: { viewport: { width: 768, height: 1024 } },
    },
    {
      name: "desktop-1280",
      use: { viewport: { width: 1280, height: 800 } },
    },
  ],
})

export default defineConfig(sharedPlaywrightConfig, {
  use: {
    baseURL: `${serverOrigin}${pagesBasePath}`,
  },
  webServer: {
    command: `pnpm serve:pages --host 127.0.0.1 --port ${serverPort}`,
    url: `${serverOrigin}${pagesBasePath}`,
    reuseExistingServer: false,
  },
})
