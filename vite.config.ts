import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"
import { configDefaults, defineConfig } from "vitest/config"
import { PRODUCT_METADATA } from "./src/design/brand-config.ts"
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
        includeAssets: ["icon-any.svg", "icon-maskable.svg", "brand/plus-logo.jpg"],
        manifest: {
          name: PRODUCT_METADATA.name,
          short_name: PRODUCT_METADATA.shortName,
          description: PRODUCT_METADATA.description,
          lang: "ko-KR",
          start_url: basePath,
          scope: basePath,
          display: "standalone",
          orientation: "portrait-primary",
          background_color: COLOR_TOKENS.canvas,
          theme_color: COLOR_TOKENS.accent,
          icons: [
            {
              src: `${basePath}${PRODUCT_METADATA.iconAny.slice(1)}`,
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any",
            },
            {
              src: `${basePath}${PRODUCT_METADATA.iconMaskable.slice(1)}`,
              sizes: "any",
              type: "image/svg+xml",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{html,js,css,svg,woff,woff2}"],
          globIgnores: ["**/BrowserPilotRuntime-*.js"],
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
