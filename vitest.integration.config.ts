import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    css: true,
    environment: "jsdom",
    fileParallelism: false,
    include: ["src/app/*.integration.test.tsx"],
    maxWorkers: 1,
    setupFiles: ["./src/test/setup.ts"],
  },
})
