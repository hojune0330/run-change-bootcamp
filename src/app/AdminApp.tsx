import { adminModel, type DemoRepository, type DemoState } from "../demo/index.ts"
import { type BrandConfig, DEFAULT_BRAND } from "../design/brand-config.ts"
import { AdminDashboard } from "../features/admin/index.ts"
import { AppShell } from "./AppShell.tsx"
import type { AdminHref } from "./routes.ts"

type AdminAppProps = {
  readonly brand?: BrandConfig
  readonly href: AdminHref
  readonly onNavigate: (href: string) => void
  readonly repository: DemoRepository
  readonly state: DemoState
}

export function AdminApp({ brand = DEFAULT_BRAND, href, onNavigate, state }: AdminAppProps) {
  const model = adminModel(state)
  const brandedModel = {
    ...model,
    programName: `${brand.productName} 2026`,
    members: model.members.map((member) => ({
      ...member,
      cohortLabel: member.cohortLabel.replace("RUN CHANGE", brand.productName),
    })),
  }

  return (
    <AppShell
      activeHref={href}
      brand={brand}
      mode="admin"
      onNavigate={onNavigate}
      sessionLabel={`${brand.productName} 운영자`}
    >
      <AdminDashboard model={brandedModel} />
    </AppShell>
  )
}
