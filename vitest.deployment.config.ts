import { defineConfig } from "vitest/config"
import { deploymentTestTimeoutMs } from "./scripts/pages-deployment-timeouts.ts"

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    include: ["scripts/pages-deployment.test.ts"],
    maxWorkers: 1,
    testTimeout: deploymentTestTimeoutMs,
  },
})
