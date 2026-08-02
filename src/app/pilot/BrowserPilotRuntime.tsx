import { createBrowserPilotGateway } from "../../integrations/supabase/browser-client.ts"
import type { SupabasePublicConfig } from "../../integrations/supabase/runtime-config.ts"
import { PilotRuntime } from "./PilotRuntime.tsx"

type BrowserPilotRuntimeProps = {
  readonly config: SupabasePublicConfig
}

export function BrowserPilotRuntime({ config }: BrowserPilotRuntimeProps) {
  return <PilotRuntime config={config} gatewayFactory={createBrowserPilotGateway} />
}
