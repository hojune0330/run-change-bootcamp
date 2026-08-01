import { defineConfig } from "@playwright/test"
import { sharedPlaywrightConfig } from "./playwright.config.ts"

const serverPort = process.env.PLAYWRIGHT_PORT ?? "4173"
const serverOrigin = `http://127.0.0.1:${serverPort}`

export default defineConfig(sharedPlaywrightConfig, {
  testIgnore: "pages-deployment.spec.ts",
  use: {
    baseURL: `${serverOrigin}/`,
  },
  webServer: {
    command: `pnpm preview:local --host 127.0.0.1 --port ${serverPort}`,
    url: serverOrigin,
    reuseExistingServer: false,
  },
})
