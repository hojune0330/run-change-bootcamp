import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"
import { configDefaults, defineConfig } from "vitest/config"
import { COLOR_TOKENS } from "./src/design/color-tokens.ts"

export default defineConfig({
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
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait-primary",
        background_color: COLOR_TOKENS.canvas,
        theme_color: COLOR_TOKENS.accent,
        icons: [
          {
            src: "/icon-any.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/icon-maskable.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{html,js,css,svg,woff,woff2}"],
        navigateFallback: "/index.html",
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
    exclude: [...configDefaults.exclude, "e2e/**"],
    css: true,
    coverage: {
      reporter: ["text", "html"],
    },
  },
})
