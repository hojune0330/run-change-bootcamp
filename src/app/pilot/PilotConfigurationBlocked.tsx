import { BrandLogo } from "../../components/BrandLogo.tsx"
import { Badge, Card } from "../../components/primitives/index.ts"
import { type BrandConfig, DEFAULT_BRAND } from "../../design/brand-config.ts"
import type { RuntimeConfiguration } from "../../integrations/supabase/index.ts"

type BlockedReason = Extract<RuntimeConfiguration, { readonly kind: "blocked" }>["reason"]

type PilotConfigurationBlockedProps = {
  readonly brand?: BrandConfig
  readonly reason: BlockedReason
}

export function PilotConfigurationBlocked({
  brand = DEFAULT_BRAND,
  reason,
}: PilotConfigurationBlockedProps) {
  return (
    <main
      className="demo-entry"
      data-brand-tenant={brand.tenantId}
      data-product={brand.productName}
      id="main-content"
    >
      <section
        aria-labelledby="pilot-blocked-title"
        className="demo-entry__panel"
        data-brand-auth-label={brand.labels.auth}
        data-block-reason={reason}
        role="alert"
      >
        <header className="demo-entry__header">
          <BrandLogo brand={brand} className="demo-entry__brand-logo" />
          <Badge tone="critical">PILOT BLOCKED</Badge>
          <p>{brand.tenantName}</p>
          <h1 id="pilot-blocked-title">파일럿 설정이 필요합니다</h1>
          <span>공개 Supabase URL과 공개 키를 확인해 주세요.</span>
        </header>

        <Card eyebrow="FAIL CLOSED" title="연결 차단됨" tone="muted">
          <p className="demo-entry__note">
            설정이 완전하고 올바를 때까지 로그인과 운영 데이터 연결을 시작하지 않습니다.
          </p>
        </Card>
      </section>
    </main>
  )
}
