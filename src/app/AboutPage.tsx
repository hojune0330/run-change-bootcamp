import { BrandLogo } from "../components/BrandLogo.tsx"
import { Badge, Card } from "../components/primitives/index.ts"
import { type BrandConfig, DEFAULT_BRAND } from "../design/brand-config.ts"

type AboutPageProps = {
  readonly brand?: BrandConfig
  readonly onNavigate: (href: string) => void
}

export function AboutPage({ brand = DEFAULT_BRAND, onNavigate }: AboutPageProps) {
  return (
    <main
      className="demo-entry"
      data-brand-tenant={brand.tenantId}
      data-product={brand.productName}
      id="main-content"
    >
      <section aria-labelledby="about-title" className="demo-entry__panel about-page">
        <header className="demo-entry__header">
          <a
            aria-label={`${brand.productName} 홈`}
            className="about-page__back"
            href="/"
            onClick={(event) => {
              event.preventDefault()
              onNavigate("/")
            }}
          >
            ← 세션 선택
          </a>
          <BrandLogo brand={brand} className="demo-entry__brand-logo" />
          <Badge tone="success">PRODUCT IDENTITY</Badge>
          <p>{brand.tenantName}</p>
          <h1 id="about-title">{brand.productName} 소개</h1>
          <span>오늘의 달리기와 변화를 기록하는 {brand.tenantName} 프로그램입니다.</span>
        </header>
        <Card eyebrow="BRAND CONTRACT" title="운영 표면 안내">
          <p className="about-page__copy">
            이 표면은 프로그램 이름, tenant 표시명, 로고와 접근성 레이블을 같은 브랜드 설정으로
            연결해 보여줍니다.
          </p>
          <dl className="admin-page__details">
            <div>
              <dt>제품</dt>
              <dd>{brand.productName}</dd>
            </div>
            <div>
              <dt>테넌트</dt>
              <dd>{brand.tenantName}</dd>
            </div>
            <div>
              <dt>공유 레이블</dt>
              <dd>{brand.labels.share}</dd>
            </div>
          </dl>
        </Card>
      </section>
    </main>
  )
}
