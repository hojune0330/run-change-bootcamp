import "@fontsource-variable/jetbrains-mono/wght.css"
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css"
import { lazy, StrictMode, Suspense } from "react"
import { createRoot } from "react-dom/client"
import { PRODUCT_METADATA, resolveBrandConfig } from "./design/brand-config.ts"
import { COLOR_TOKEN_ENTRIES } from "./design/color-tokens.ts"
import "./design/tokens.css"
import "./design/global.css"
import { shouldLoadReactDevTools } from "./app/react-dev-tools.ts"

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

if (shouldLoadReactDevTools(import.meta.env)) {
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
