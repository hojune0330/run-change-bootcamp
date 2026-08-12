import react from "@vitejs/plugin-react"
import { loadEnv, type Plugin } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import { configDefaults, defineConfig } from "vitest/config"
import { shouldLoadReactDevTools } from "./src/app/react-dev-tools.ts"
import { PRODUCT_METADATA } from "./src/design/brand-config.ts"
import { COLOR_TOKENS } from "./src/design/color-tokens.ts"

const LOCAL_BASE_PATH = "/"
const PAGES_BASE_PATH = "/run-change-bootcamp/"
const PAGES_BUILD_MODE = "pages"
const REACT_DEV_TOOLS_ENTRY = "/src/app/react-dev-tools-entry.ts"
const PROJECT_TEST_EXCLUDES = [
  ".omo/**",
  ".artifacts/**",
  "dev-dist/**",
  "dist/**",
  "scripts/pages-deployment.test.ts",
  "src/app/*.integration.test.tsx",
] as const

function reactDevToolsPlugin(): Plugin {
  return {
    name: "plus-run-react-dev-tools",
    transformIndexHtml() {
      return [
        {
          tag: "script",
          attrs: { type: "module", src: REACT_DEV_TOOLS_ENTRY },
          injectTo: "head",
        },
      ]
    },
  }
}

export default defineConfig(({ command, mode }) => {
  const basePath = mode === PAGES_BUILD_MODE ? PAGES_BASE_PATH : LOCAL_BASE_PATH
  const environment = loadEnv(mode, process.cwd(), "")
  const { VITE_DISABLE_REACT_DEVTOOLS, VITE_ENABLE_DEV_TOOLS } = environment
  const devToolsEnabled = shouldLoadReactDevTools({
    DEV: command === "serve",
    ...(VITE_DISABLE_REACT_DEVTOOLS === undefined ? {} : { VITE_DISABLE_REACT_DEVTOOLS }),
    ...(VITE_ENABLE_DEV_TOOLS === undefined ? {} : { VITE_ENABLE_DEV_TOOLS }),
  })

  return {
    base: basePath,
    plugins: [
      react(),
      ...(devToolsEnabled ? [reactDevToolsPlugin()] : []),
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
