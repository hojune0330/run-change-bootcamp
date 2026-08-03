import { Card } from "../components/primitives/index.ts"
import { type BrandConfig, DEFAULT_BRAND } from "../design/brand-config.ts"
import { AppShell } from "./AppShell.tsx"
import type { AdminHref } from "./routes.ts"

type AdminAppProps = {
  readonly brand?: BrandConfig
  readonly href: AdminHref
  readonly onNavigate: (href: string) => void
}

const PAGE_COPY = {
  "/admin/overview": {
    eyebrow: "OPERATIONS",
    title: "운영 개요",
    description: "멤버, 일정, 공지와 리포트 상태를 한 화면에서 확인합니다.",
  },
  "/admin/members": {
    eyebrow: "MEMBERS",
    title: "멤버 관리",
    description: "참여자와 코치 계정의 초대·상태·권한을 확인합니다.",
  },
  "/admin/schedule": {
    eyebrow: "SCHEDULE",
    title: "일정 관리",
    description: "이번 프로그램의 세션과 과제 일정을 조율합니다.",
  },
  "/admin/settings": {
    eyebrow: "SETTINGS",
    title: "운영 설정",
    description: "tenant 표시명과 프로그램 운영 규칙을 확인합니다.",
  },
} as const

export function AdminApp({ brand = DEFAULT_BRAND, href, onNavigate }: AdminAppProps) {
  const copy = PAGE_COPY[href]
  return (
    <AppShell
      activeHref={href}
      brand={brand}
      mode="admin"
      onNavigate={onNavigate}
      sessionLabel={`${brand.productName} 운영자`}
    >
      <section aria-labelledby="admin-page-title" className="admin-page">
        <header className="admin-page__header">
          <p className="admin-page__eyebrow">
            {copy.eyebrow} · {brand.tenantName}
          </p>
          <h1 id="admin-page-title">{copy.title}</h1>
          <p>{copy.description}</p>
        </header>
        <div className="admin-page__grid">
          <Card eyebrow="PROGRAM" title={brand.productName}>
            <dl className="admin-page__details">
              <div>
                <dt>테넌트</dt>
                <dd>
                  {brand.tenantName.replace(` ${brand.productName}`, "")}{" "}
                  <span className="admin-page__product-name">{brand.productName}</span>
                </dd>
              </div>
              <div>
                <dt>운영 상태</dt>
                <dd>정상 운영</dd>
              </div>
            </dl>
          </Card>
          <Card eyebrow="WORKSPACE" title="오늘의 운영 신호" tone="muted">
            <ul className="admin-page__signals">
              <li>
                <strong>20명</strong>
                <span>등록 멤버</span>
              </li>
              <li>
                <strong>4건</strong>
                <span>예정 세션</span>
              </li>
              <li>
                <strong>0건</strong>
                <span>긴급 알림</span>
              </li>
            </ul>
          </Card>
        </div>
      </section>
    </AppShell>
  )
}
