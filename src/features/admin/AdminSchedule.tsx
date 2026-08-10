import { Badge, type BadgeTone } from "../../components/primitives/index.ts"
import type { AdminScheduleViewModel, AdminSessionRow } from "./types.ts"
import "./admin-dashboard.css"

export type AdminScheduleProps = {
  readonly model: AdminScheduleViewModel
}

function kindTone(session: AdminSessionRow): BadgeTone {
  return session.kindLabel === "기록 측정" || session.kindLabel === "재측정" ? "success" : "neutral"
}

export function AdminSchedule({ model }: AdminScheduleProps) {
  return (
    <section aria-label="관리자 프로그램 일정" className="admin-dashboard">
      <header className="admin-dashboard__header">
        <div>
          <p className="admin-dashboard__eyebrow">프로그램 일정 · {model.dateRangeLabel}</p>
          <h1>{model.programName}</h1>
          <span>세션 회차별 일정과 기록 측정 계획을 한 화면에서 확인합니다.</span>
        </div>
        <Badge tone="success">프로그램 일정</Badge>
      </header>

      <ul aria-label="일정 현황" className="admin-kpis">
        <li className="admin-kpi">
          <span>전체 세션</span>
          <strong>{model.summary.totalSessions}회</strong>
          <small>등록된 일정</small>
        </li>
        <li className="admin-kpi">
          <span>예정</span>
          <strong>{model.summary.upcomingCount}회</strong>
          <small>다가오는 세션</small>
        </li>
        <li className="admin-kpi">
          <span>완료</span>
          <strong>{model.summary.pastCount}회</strong>
          <small>지난 세션</small>
        </li>
        <li className="admin-kpi">
          <span>기록 측정</span>
          <strong>{model.timeTrialLabel}</strong>
          <small>타임 트라이얼</small>
        </li>
      </ul>

      {model.sessions.length === 0 ? (
        <p className="admin-activity__empty" role="status">
          아직 등록된 세션이 없습니다. 일정이 추가되면 여기에 표시돼요.
        </p>
      ) : (
        <div className="admin-activity__table-wrap admin-activity__table-wrap--stacked">
          <table
            aria-label="프로그램 일정"
            className="admin-activity__table admin-activity__table--stacked"
          >
            <thead>
              <tr>
                <th scope="col">회차</th>
                <th scope="col">종류</th>
                <th scope="col">제목</th>
                <th scope="col">일시</th>
              </tr>
            </thead>
            <tbody>
              {model.sessions.map((session) => (
                <tr key={session.id}>
                  <td data-label="회차">{session.sessionNumber}회차</td>
                  <td data-label="종류">
                    <Badge tone={kindTone(session)}>{session.kindLabel}</Badge>
                  </td>
                  <td data-label="제목">{session.title}</td>
                  <td data-label="일시">{session.scheduledAtLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
