import { Badge, type BadgeTone, Card } from "../../components/primitives/index.ts"
import { AdminActivityLog } from "./AdminActivityLog.tsx"
import type { AdminActivityTone, AdminDashboardViewModel } from "./types.ts"
import "./admin-dashboard.css"

function badgeTone(tone: AdminActivityTone): BadgeTone {
  return tone === "danger" ? "critical" : tone === "default" ? "neutral" : tone
}

export type AdminDashboardProps = {
  readonly model: AdminDashboardViewModel
}

export function AdminDashboard({ model }: AdminDashboardProps) {
  return (
    <section aria-label="관리자 운영 대시보드" className="admin-dashboard">
      <header className="admin-dashboard__header">
        <div>
          <p className="admin-dashboard__eyebrow">운영 개요 · {model.dateRangeLabel}</p>
          <h1>{model.programName}</h1>
          <span>멤버, 공유 동의, 발행 콘텐츠와 최근 활동을 한 화면에서 확인합니다.</span>
        </div>
        <Badge tone="success">{model.operationStatusLabel}</Badge>
      </header>

      <ul aria-label="운영 지표" className="admin-kpis">
        {model.kpis.map((kpi) => (
          <li key={kpi.id} className="admin-kpi">
            <span>{kpi.label}</span>
            <strong>{kpi.value}</strong>
            <small>{kpi.hint}</small>
          </li>
        ))}
      </ul>

      <div className="admin-dashboard__grid">
        <Card eyebrow="최근 활동" title="코치·관리자가 한 일">
          {model.recentActivity.length === 0 ? (
            <p className="admin-activity__empty" role="status">
              아직 기록된 활동이 없어요. 코치가 발행·승인·결정하면 여기에 표시돼요.
            </p>
          ) : (
            <ul className="admin-recent">
              {model.recentActivity.map((entry) => (
                <li key={entry.id}>
                  <Badge tone={badgeTone(entry.tone)}>{entry.actionLabel}</Badge>
                  <span>{entry.summary}</span>
                  <small>
                    {entry.actorLabel} · {entry.createdAtLabel}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card eyebrow="프로그램" title="운영 상태">
          <dl className="admin-details">
            <div>
              <dt>테넌트</dt>
              <dd>한화생명 PLUS Run</dd>
            </div>
            <div>
              <dt>첫 기록 측정</dt>
              <dd>{model.timeTrialLabel}</dd>
            </div>
            <div>
              <dt>건강 공유</dt>
              <dd>{model.consentedCount}명</dd>
            </div>
            <div>
              <dt>발행 과제</dt>
              <dd>{model.assignmentsCount}건</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card eyebrow="전체 활동" title="활동 로그">
        <AdminActivityLog actionOptions={model.actionOptions} entries={model.activity} />
      </Card>
    </section>
  )
}
