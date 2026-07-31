import { defineConfig } from "@playwright/test"

const readEnvironment = (name: string) => process.env[name]
const usePagesStaticServer = readEnvironment("PAGES_STATIC_SERVER") === "1"
const usePagesPreview = readEnvironment("PAGES_PREVIEW") === "1"
const serverPort = readEnvironment("PLAYWRIGHT_PORT") ?? "4173"

export default defineConfig({
  testDir: "./e2e",
  outputDir: ".artifacts/playwright",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${serverPort}`,
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
    command: usePagesStaticServer
      ? `pnpm serve:pages --host 127.0.0.1 --port ${serverPort}`
      : usePagesPreview
        ? `pnpm preview:pages --host 127.0.0.1 --port ${serverPort}`
        : `pnpm preview --host 127.0.0.1 --port ${serverPort}`,
    url: `http://127.0.0.1:${serverPort}`,
    reuseExistingServer: false,
  },
})
