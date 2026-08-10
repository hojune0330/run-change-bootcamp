import { Badge, Card } from "../components/primitives/index.ts"
import {
  adminMembersModel,
  adminModel,
  adminReportsModel,
  adminScheduleModel,
  adminSettingsModel,
  DEMO_DATA_PROVENANCE_LABEL,
  type DemoRepository,
  type DemoState,
} from "../demo/index.ts"
import { type BrandConfig, DEFAULT_BRAND } from "../design/brand-config.ts"
import {
  AdminActivityLog,
  AdminDashboard,
  AdminMemberRoster,
  AdminReports,
  AdminSchedule,
  AdminSettings,
} from "../features/admin/index.ts"
import { AppShell } from "./AppShell.tsx"
import type { AdminHref } from "./routes.ts"

type AdminAppProps = {
  readonly brand?: BrandConfig
  readonly href: AdminHref
  readonly onNavigate: (href: string) => void
  readonly repository: DemoRepository
  readonly state: DemoState
}

type AdminRouteScreenProps = {
  readonly brand: BrandConfig
  readonly href: AdminHref
  readonly programName: string
  readonly state: DemoState
}

function AdminRouteScreen({ brand, href, programName, state }: AdminRouteScreenProps) {
  switch (href) {
    case "/admin/members":
      return <AdminMemberRoster model={adminMembersModel(state, programName)} />
    case "/admin/schedule":
      return <AdminSchedule model={adminScheduleModel(state, programName)} />
    case "/admin/reports":
      return <AdminReports model={adminReportsModel(state, programName)} />
    case "/admin/settings":
      return <AdminSettings model={adminSettingsModel(state, programName)} />
    case "/admin/activity": {
      const model = adminModel(state)
      return (
        <section aria-label="관리자 활동 로그" className="admin-dashboard">
          <header className="admin-dashboard__header">
            <div>
              <p className="admin-dashboard__eyebrow">전체 활동 · {model.dateRangeLabel}</p>
              <h1>{programName}</h1>
              <span>코치와 관리자의 발행·승인·결정 기록을 시간순으로 확인합니다.</span>
            </div>
            <Badge tone="neutral">감사 기록</Badge>
          </header>
          <Card eyebrow="전체 활동" title="활동 로그">
            <AdminActivityLog actionOptions={model.actionOptions} entries={model.activity} />
          </Card>
        </section>
      )
    }
    case "/admin/overview": {
      const model = adminModel(state)
      return (
        <AdminDashboard
          model={{
            ...model,
            programName,
            members: model.members.map((member) => ({
              ...member,
              cohortLabel: member.cohortLabel.replace("RUN CHANGE", brand.productName),
            })),
          }}
        />
      )
    }
  }
}

export function AdminApp({ brand = DEFAULT_BRAND, href, onNavigate, state }: AdminAppProps) {
  const programName = `${brand.productName} 2026`

  return (
    <AppShell
      activeHref={href}
      brand={brand}
      mode="admin"
      onNavigate={onNavigate}
      provenanceLabel={DEMO_DATA_PROVENANCE_LABEL}
      sessionLabel={`${brand.productName} 운영자`}
    >
      <AdminRouteScreen brand={brand} href={href} programName={programName} state={state} />
    </AppShell>
  )
}
