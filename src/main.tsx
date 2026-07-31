import "@fontsource-variable/jetbrains-mono/wght.css"
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./app/App.tsx"
import { COLOR_TOKEN_ENTRIES } from "./design/color-tokens.ts"
import "./design/tokens.css"
import "./design/global.css"

class MissingRootElementError extends Error {
  constructor() {
    super("RUN CHANGE could not find its root element")
    this.name = "MissingRootElementError"
  }
}

for (const [property, value] of COLOR_TOKEN_ENTRIES) {
  document.documentElement.style.setProperty(property, value)
}

const rootElement = document.getElementById("root")

if (rootElement === null) {
  throw new MissingRootElementError()
}

if (import.meta.env.DEV && import.meta.env.VITE_DISABLE_REACT_DEVTOOLS !== "1") {
  void import("react-grab")
  void import("react-scan")
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
