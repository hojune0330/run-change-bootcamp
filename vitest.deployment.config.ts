import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    include: ["scripts/pages-deployment.test.ts"],
    maxWorkers: 1,
    testTimeout: 0,
  },
})
