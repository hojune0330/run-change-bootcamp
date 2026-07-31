import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  outputDir: ".artifacts/playwright",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
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
  webServer: {
    command: "pnpm preview --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
})
