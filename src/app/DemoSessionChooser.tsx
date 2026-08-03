import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/ArrowCounterClockwise"
import { SignInIcon } from "@phosphor-icons/react/SignIn"
import { UsersThreeIcon } from "@phosphor-icons/react/UsersThree"
import { useState } from "react"
import { BrandLogo } from "../components/BrandLogo.tsx"
import { Badge, Button, Card } from "../components/primitives/index.ts"
import type { DemoParticipantId, DemoRepository } from "../demo/index.ts"
import { type BrandConfig, DEFAULT_BRAND } from "../design/brand-config.ts"
import { DEMO_PARTICIPANTS } from "../fixtures/index.ts"

type DemoSessionChooserProps = {
  readonly brand?: BrandConfig
  readonly onNavigate: (href: string) => void
  readonly repository: DemoRepository
}

export function DemoSessionChooser({
  brand = DEFAULT_BRAND,
  onNavigate,
  repository,
}: DemoSessionChooserProps) {
  const [participantId, setParticipantId] = useState<DemoParticipantId | null>(
    DEMO_PARTICIPANTS[0]?.id ?? null,
  )

  return (
    <main
      className="demo-entry"
      data-brand-tenant={brand.tenantId}
      data-product={brand.productName}
      id="main-content"
    >
      <section aria-labelledby="demo-session-title" className="demo-entry__panel">
        <header className="demo-entry__header">
          <BrandLogo brand={brand} className="demo-entry__brand-logo" />
          <Badge tone="success">SEEDED DEMO · 20명</Badge>
          <p>{brand.tenantName}</p>
          <h1 id="demo-session-title">데모 세션 선택</h1>
          <span>참여자와 코치가 같은 저장소에서 변화를 확인합니다.</span>
          <a
            className="demo-entry__about-link"
            href="/about"
            onClick={(event) => {
              event.preventDefault()
              onNavigate("/about")
            }}
          >
            {brand.productName} 소개
          </a>
        </header>

        <Card eyebrow="DEMO ACCESS" title="바로 시작하기">
          <div className="demo-entry__choices">
            <label className="demo-entry__field">
              <span>참여자 선택</span>
              <select
                onChange={(event) => {
                  const selected = DEMO_PARTICIPANTS.find(
                    (participant) => participant.id === event.currentTarget.value,
                  )
                  if (selected !== undefined) setParticipantId(selected.id)
                }}
                value={participantId ?? ""}
              >
                {DEMO_PARTICIPANTS.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {String(participant.cohortNumber).padStart(2, "0")} · {participant.displayName}
                  </option>
                ))}
              </select>
            </label>
            <div className="demo-entry__actions">
              <Button
                disabled={participantId === null}
                icon={<SignInIcon aria-hidden size={20} weight="bold" />}
                onClick={() => {
                  if (participantId === null) return
                  repository.chooseParticipant(participantId)
                  onNavigate("/today")
                }}
              >
                참여자로 시작
              </Button>
              <Button
                icon={<UsersThreeIcon aria-hidden size={20} weight="bold" />}
                onClick={() => {
                  repository.chooseCoach()
                  onNavigate("/coach/cohort")
                }}
                variant="secondary"
              >
                코치로 시작
              </Button>
            </div>
          </div>
        </Card>

        <Card eyebrow="PRODUCTION SETUP" title="로그인 연결 안내" tone="muted">
          <p className="demo-entry__note">
            <span>이 화면은 로컬 데모입니다.</span>
            <span>이메일 매직 링크를 연결하세요.</span>
            <span>Supabase 인증 키를 설정하세요.</span>
            <span>허용 URL도 설정하세요.</span>
          </p>
          <Button
            icon={<ArrowCounterClockwiseIcon aria-hidden size={19} weight="bold" />}
            onClick={() => repository.reset()}
            variant="quiet"
          >
            데모 안전 초기화
          </Button>
        </Card>
      </section>
    </main>
  )
}
