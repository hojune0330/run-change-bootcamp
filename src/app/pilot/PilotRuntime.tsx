import { useState } from "react"
import { type BrandConfig, DEFAULT_BRAND } from "../../design/brand-config.ts"
import type { PilotGatewayFactory } from "../../integrations/supabase/pilot-gateway.ts"
import type { SupabasePublicConfig } from "../../integrations/supabase/runtime-config.ts"
import { PilotAuthShell } from "./PilotAuthShell.tsx"

type PilotRuntimeProps = {
  readonly brand?: BrandConfig
  readonly config: SupabasePublicConfig
  readonly gatewayFactory: PilotGatewayFactory
}

export function PilotRuntime({ brand = DEFAULT_BRAND, config, gatewayFactory }: PilotRuntimeProps) {
  const [gateway] = useState(() => gatewayFactory(config))
  return <PilotAuthShell brand={brand} gateway={gateway} />
}
