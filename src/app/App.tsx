import { lazy, Suspense } from "react"
import { resolveBrandConfig } from "../design/brand-config.ts"
import type { PilotGatewayFactory } from "../integrations/supabase/pilot-gateway.ts"
import {
  type RuntimeEnvironment,
  resolveRuntimeConfiguration,
} from "../integrations/supabase/runtime-config.ts"
import { PreviewApp } from "./PreviewApp.tsx"
import { PilotConfigurationBlocked } from "./pilot/PilotConfigurationBlocked.tsx"
import { PilotRuntime } from "./pilot/PilotRuntime.tsx"
import "./App.css"

const BrowserPilotRuntime = lazy(() =>
  import("./pilot/BrowserPilotRuntime.tsx").then(({ BrowserPilotRuntime }) => ({
    default: BrowserPilotRuntime,
  })),
)

type AppProps = {
  readonly pilotGatewayFactory?: PilotGatewayFactory
  readonly runtimeEnvironment?: RuntimeEnvironment
}

export function App({ pilotGatewayFactory, runtimeEnvironment = import.meta.env }: AppProps = {}) {
  const runtime = resolveRuntimeConfiguration(runtimeEnvironment)
  const brand = resolveBrandConfig(runtimeEnvironment)
  switch (runtime.kind) {
    case "blocked":
      return <PilotConfigurationBlocked brand={brand} reason={runtime.reason} />
    case "ready":
      switch (runtime.mode) {
        case "preview":
          return <PreviewApp brand={brand} />
        case "pilot":
          return pilotGatewayFactory === undefined ? (
            <Suspense
              fallback={
                <main className="demo-entry" id="main-content">
                  <p aria-live="polite" className="pilot-entry__status">
                    파일럿 연결 모듈을 불러오고 있습니다.
                  </p>
                </main>
              }
            >
              <BrowserPilotRuntime brand={brand} config={runtime.config} />
            </Suspense>
          ) : (
            <PilotRuntime
              brand={brand}
              config={runtime.config}
              gatewayFactory={pilotGatewayFactory}
            />
          )
      }
  }
}
