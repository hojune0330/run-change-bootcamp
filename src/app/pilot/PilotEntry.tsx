import { resolveBrandConfig } from "../../design/brand-config.ts"
import { resolveRuntimeConfiguration } from "../../integrations/supabase/runtime-config.ts"
import "../App.css"
import { PilotApplication } from "./PilotApplication.tsx"
import { PilotConfigurationBlocked } from "./PilotConfigurationBlocked.tsx"

export function PilotEntry() {
  const brand = resolveBrandConfig(import.meta.env)
  const runtime = resolveRuntimeConfiguration(import.meta.env)
  if (runtime.kind === "blocked") {
    return <PilotConfigurationBlocked brand={brand} reason={runtime.reason} />
  }
  if (runtime.mode !== "pilot") {
    return <PilotConfigurationBlocked brand={brand} reason="invalid_runtime" />
  }
  return <PilotApplication brand={brand} config={runtime.config} />
}
