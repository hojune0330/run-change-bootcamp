import { resolveBrandConfig } from "../design/brand-config.ts"
import type { PilotGatewayFactory } from "../integrations/supabase/pilot-gateway.ts"
import {
  type RuntimeEnvironment,
  resolveRuntimeConfiguration,
} from "../integrations/supabase/runtime-config.ts"
import { PreviewApp } from "./PreviewApp.tsx"
import { PilotApplication } from "./pilot/PilotApplication.tsx"
import { PilotConfigurationBlocked } from "./pilot/PilotConfigurationBlocked.tsx"
import "./App.css"

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
          return (
            <PilotApplication
              brand={brand}
              config={runtime.config}
              {...(pilotGatewayFactory === undefined
                ? {}
                : { gatewayFactory: pilotGatewayFactory })}
            />
          )
      }
  }
}
