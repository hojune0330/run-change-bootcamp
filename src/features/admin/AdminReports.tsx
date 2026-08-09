import { Badge, type BadgeTone, Card } from "../../components/primitives/index.ts"
import type { AdminReportsViewModel } from "./types.ts"
import "./admin-dashboard.css"

function statusTone(tone: AdminReportsViewModel["snapshots"][number]["statusTone"]): BadgeTone {
  return tone === "success" ? "success" : tone === "warning" ? "warning" : "neutral"
}

export type AdminReportsProps = {
  readonly model: AdminReportsViewModel
}

export function AdminReports({ model }: AdminReportsProps) {
  return (
    <section aria-label="관리자 운영 보고" className="admin-dashboard">
      <header className="admin-dashboard__header">
        <div>
          <p className="admin-dashboard__eyebrow">운영 보고 · {model.dateRangeLabel}</p>
          <h1>{model.programName}</h1>
          <span>
            집계 보고서 스냅샷과 소규모 셀(참여자 5명 미만) 보호 상태를 한 화면에서 확인합니다.
          </span>
        </div>
        <Badge tone="neutral">집계 전용</Badge>
      </header>

      <ul aria-label="보고 현황" className="admin-kpis">
        <li className="admin-kpi">
          <span>보고서</span>
          <strong>{model.summary.reportCount}건</strong>
          <small>전체 스냅샷</small>
        </li>
        <li className="admin-kpi">
          <span>발행됨</span>
          <strong>{model.summary.releasedCount}건</strong>
          <small>이해관계자 공개</small>
        </li>
      </ul>

      {model.snapshots.length === 0 ? (
        <Card eyebrow="집계 스냅샷" title="발행된 보고서가 없습니다">
          <p className="admin-activity__empty" role="status">
            측정 프로토콜이 확정되고 보고서가 생성되면 여기에 표시돼요. 소규모 셀은 항상 비식별
            처리되어 보여집니다.
          </p>
        </Card>
      ) : (
        model.snapshots.map((snapshot) => (
          <Card eyebrow="집계 스냅샷" key={snapshot.id} title={`${model.programName} 보고서`}>
            <div className="admin-activity__filters">
              <dl className="admin-details">
                <div>
                  <dt>상태</dt>
                  <dd>
                    <Badge tone={statusTone(snapshot.statusTone)}>{snapshot.statusLabel}</Badge>
                  </dd>
                </div>
                <div>
                  <dt>생성일</dt>
                  <dd>{snapshot.generatedAtLabel}</dd>
                </div>
                <div>
                  <dt>발행일</dt>
                  <dd>{snapshot.releasedAtLabel}</dd>
                </div>
              </dl>
            </div>
            <div className="admin-activity__table-wrap admin-activity__table-wrap--stacked">
              <table
                aria-label="집계 셀"
                className="admin-activity__table admin-activity__table--stacked"
              >
                <thead>
                  <tr>
                    <th scope="col">항목</th>
                    <th scope="col">구분</th>
                    <th scope="col">참여자 수</th>
                    <th scope="col">값</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.cells.map((cell) => (
                    <tr key={cell.id}>
                      <td data-label="항목">{cell.rowLabel}</td>
                      <td data-label="구분">{cell.columnLabel}</td>
                      <td data-label="참여자 수">
                        {cell.suppressed ? (
                          <Badge tone="neutral">숨김</Badge>
                        ) : (
                          cell.participantCountLabel
                        )}
                      </td>
                      <td data-label="값">{cell.suppressed ? "—" : cell.valueLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="admin-activity__empty">
              참여자 5명 미만 셀과 보완 셀은 값을 숨겨 개인 식별을 막습니다.
            </p>
          </Card>
        ))
      )}
    </section>
  )
}
