export type ReactDevToolsEnvironment = {
  readonly DEV: boolean
  readonly VITE_DISABLE_REACT_DEVTOOLS?: string
  readonly VITE_ENABLE_DEV_TOOLS?: string
}

export function shouldLoadReactDevTools(environment: ReactDevToolsEnvironment): boolean {
  return (
    environment.DEV &&
    environment.VITE_DISABLE_REACT_DEVTOOLS !== "1" &&
    environment.VITE_ENABLE_DEV_TOOLS === "1"
  )
}
