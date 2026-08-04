import { type BrandConfig, DEFAULT_BRAND } from "../../design/brand-config.ts"
import { createBrowserPilotGateway } from "../../integrations/supabase/browser-client.ts"
import type { SupabasePublicConfig } from "../../integrations/supabase/runtime-config.ts"
import { PilotRuntime } from "./PilotRuntime.tsx"

type BrowserPilotRuntimeProps = {
  readonly brand?: BrandConfig
  readonly config: SupabasePublicConfig
}

export function BrowserPilotRuntime({ brand = DEFAULT_BRAND, config }: BrowserPilotRuntimeProps) {
  return <PilotRuntime brand={brand} config={config} gatewayFactory={createBrowserPilotGateway} />
}
