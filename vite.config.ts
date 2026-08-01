import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"
import { configDefaults, defineConfig } from "vitest/config"
import { COLOR_TOKENS } from "./src/design/color-tokens.ts"

const LOCAL_BASE_PATH = "/"
const PAGES_BASE_PATH = "/run-change-bootcamp/"
const PAGES_BUILD_MODE = "pages"
const PROJECT_TEST_EXCLUDES = [
  ".omo/**",
  ".artifacts/**",
  "dev-dist/**",
  "dist/**",
  "scripts/pages-deployment.test.ts",
  "src/app/*.integration.test.tsx",
] as const

export default defineConfig(({ mode }) => {
  const basePath = mode === PAGES_BUILD_MODE ? PAGES_BASE_PATH : LOCAL_BASE_PATH

  return {
    base: basePath,
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["icon-any.svg", "icon-maskable.svg"],
        manifest: {
          name: "RUN CHANGE Bootcamp",
          short_name: "RUN CHANGE",
          description: "한화생명 러닝 부트캠프의 오늘 할 일과 변화를 기록하는 앱",
          lang: "ko-KR",
          start_url: basePath,
          scope: basePath,
          display: "standalone",
          orientation: "portrait-primary",
          background_color: COLOR_TOKENS.canvas,
          theme_color: COLOR_TOKENS.accent,
          icons: [
            {
              src: `${basePath}icon-any.svg`,
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any",
            },
            {
              src: `${basePath}icon-maskable.svg`,
              sizes: "any",
              type: "image/svg+xml",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{html,js,css,svg,woff,woff2}"],
          navigateFallback: `${basePath}index.html`,
          cleanupOutdatedCaches: true,
        },
        devOptions: {
          enabled: true,
          type: "module",
        },
      }),
    ],
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      exclude: [...configDefaults.exclude, ...PROJECT_TEST_EXCLUDES, "e2e/**"],
      css: true,
      coverage: {
        reporter: ["text", "html"],
      },
    },
  }
})
