interface ImportMetaEnv {
  readonly VITE_APP_RUNTIME?: "pilot" | "preview"
  readonly VITE_DISABLE_REACT_DEVTOOLS?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_SUPABASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
