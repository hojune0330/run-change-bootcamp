import { lazy, Suspense } from "react"
import type { BrandConfig } from "../../design/brand-config.ts"
import type { PilotGatewayFactory } from "../../integrations/supabase/pilot-gateway.ts"
import type { SupabasePublicConfig } from "../../integrations/supabase/runtime-config.ts"
import { PilotRuntime } from "./PilotRuntime.tsx"

const BrowserPilotRuntime = lazy(() =>
  import("./BrowserPilotRuntime.tsx").then(({ BrowserPilotRuntime }) => ({
    default: BrowserPilotRuntime,
  })),
)

type PilotApplicationProps = {
  readonly brand: BrandConfig
  readonly config: SupabasePublicConfig
  readonly gatewayFactory?: PilotGatewayFactory
}

export function PilotApplication({ brand, config, gatewayFactory }: PilotApplicationProps) {
  return gatewayFactory === undefined ? (
    <Suspense
      fallback={
        <main className="demo-entry" id="main-content">
          <p aria-live="polite" className="pilot-entry__status">
            파일럿 연결 모듈을 불러오고 있습니다.
          </p>
        </main>
      }
    >
      <BrowserPilotRuntime brand={brand} config={config} />
    </Suspense>
  ) : (
    <PilotRuntime brand={brand} config={config} gatewayFactory={gatewayFactory} />
  )
}
