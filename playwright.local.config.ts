import { defineConfig } from "@playwright/test"
import { sharedPlaywrightConfig } from "./playwright.config.ts"

const { PLAYWRIGHT_PORT: serverPort = "4173" } = process.env
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
