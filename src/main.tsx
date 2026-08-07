import "@fontsource-variable/jetbrains-mono/wght.css"
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css"
import { lazy, StrictMode, Suspense } from "react"
import { createRoot } from "react-dom/client"
import { PRODUCT_METADATA, resolveBrandConfig } from "./design/brand-config.ts"
import { COLOR_TOKEN_ENTRIES } from "./design/color-tokens.ts"
import "./design/tokens.css"
import "./design/global.css"

const RuntimeApp =
  import.meta.env.VITE_APP_RUNTIME === "pilot"
    ? lazy(() =>
        import("./app/pilot/PilotEntry.tsx").then(({ PilotEntry }) => ({ default: PilotEntry })),
      )
    : lazy(() => import("./app/App.tsx").then(({ App }) => ({ default: App })))

class MissingRootElementError extends Error {
  constructor() {
    super("PLUS Run could not find its root element")
    this.name = "MissingRootElementError"
  }
}

for (const [property, value] of COLOR_TOKEN_ENTRIES) {
  document.documentElement.style.setProperty(property, value)
}

const activeBrand = resolveBrandConfig(import.meta.env)
document.title = PRODUCT_METADATA.name
document.documentElement.setAttribute("data-brand-tenant", activeBrand.tenantId)
const existingThemeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
if (existingThemeMeta !== null) {
  existingThemeMeta.content = PRODUCT_METADATA.themeColor
} else {
  const themeMeta = document.createElement("meta")
  themeMeta.name = "theme-color"
  themeMeta.content = PRODUCT_METADATA.themeColor
  document.head.appendChild(themeMeta)
}

const rootElement = document.getElementById("root")

if (rootElement === null) {
  throw new MissingRootElementError()
}

// Dev-only agent tooling (react-grab / react-scan) is an explicit opt-in:
// react-grab injects a full-screen overlay that intercepts pointer events and
// breaks the shell's bottom navigation clicks, so it must never be on by default.
// Set VITE_ENABLE_DEV_TOOLS=1 in your local environment to enable it.
const devToolsEnabled =
  import.meta.env.DEV &&
  import.meta.env.VITE_DISABLE_REACT_DEVTOOLS !== "1" &&
  import.meta.env.VITE_ENABLE_DEV_TOOLS === "1"
if (devToolsEnabled) {
  void import("react-grab")
  void import("react-scan")
}

createRoot(rootElement).render(
  <StrictMode>
    <Suspense fallback={null}>
      <RuntimeApp />
    </Suspense>
  </StrictMode>,
)
