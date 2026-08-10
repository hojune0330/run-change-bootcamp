import { resolveBrandConfig } from "../design/brand-config.ts"
import "./App.css"
import { PreviewApp } from "./PreviewApp.tsx"

export function PagesEntry() {
  return <PreviewApp brand={resolveBrandConfig(import.meta.env)} />
}
