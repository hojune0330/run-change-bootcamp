import { useState } from "react"
import type { PilotGatewayFactory } from "../../integrations/supabase/pilot-gateway.ts"
import type { SupabasePublicConfig } from "../../integrations/supabase/runtime-config.ts"
import { PilotAuthShell } from "./PilotAuthShell.tsx"

type PilotRuntimeProps = {
  readonly config: SupabasePublicConfig
  readonly gatewayFactory: PilotGatewayFactory
}

export function PilotRuntime({ config, gatewayFactory }: PilotRuntimeProps) {
  const [gateway] = useState(() => gatewayFactory(config))
  return <PilotAuthShell gateway={gateway} />
}
