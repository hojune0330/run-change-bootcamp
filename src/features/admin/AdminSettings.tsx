import { Badge, Card } from "../../components/primitives/index.ts"
import type { AdminSettingsViewModel } from "./types.ts"
import "./admin-dashboard.css"

export type AdminSettingsProps = {
  readonly model: AdminSettingsViewModel
}

export function AdminSettings({ model }: AdminSettingsProps) {
  return (
    <section aria-label="관리자 프로그램 설정" className="admin-dashboard">
      <header className="admin-dashboard__header">
        <div>
          <p className="admin-dashboard__eyebrow">프로그램 설정 · {model.dateRangeLabel}</p>
          <h1>{model.programName}</h1>
          <span>기록 측정 계획과 탈퇴 요청·알림 전달 상태를 한 화면에서 확인합니다.</span>
        </div>
        <Badge tone="neutral">{model.statusLabel}</Badge>
      </header>

      <ul aria-label="설정 현황" className="admin-kpis">
        <li className="admin-kpi">
          <span>기록 측정</span>
          <strong>{model.timeTrialLabel}</strong>
          <small>타임 트라이얼</small>
        </li>
        <li className="admin-kpi">
          <span>탈퇴 요청</span>
          <strong>{model.summary.deletionRequestCount}건</strong>
          <small>처리 대기</small>
        </li>
        <li className="admin-kpi">
          <span>알림 실패</span>
          <strong>{model.summary.failedNotificationCount}건</strong>
          <small>재시도 대상</small>
        </li>
      </ul>

      <Card eyebrow="삭제 요청" title="탈퇴 요청 큐">
        {model.deletionRequests.length === 0 ? (
          <p className="admin-activity__empty" role="status">
            처리 중인 탈퇴 요청이 없습니다. 멤버가 요청하면 여기에 표시돼요.
          </p>
        ) : (
          <div className="admin-activity__table-wrap">
            <table aria-label="탈퇴 요청" className="admin-activity__table">
              <thead>
                <tr>
                  <th scope="col">이름</th>
                  <th scope="col">상태</th>
                  <th scope="col">요청일</th>
                </tr>
              </thead>
              <tbody>
                {model.deletionRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.displayName}</td>
                    <td>
                      <Badge tone={request.statusTone}>{request.statusLabel}</Badge>
                    </td>
                    <td>{request.requestedAtLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card eyebrow="전달 상태" title="미전달 알림">
        {model.failedNotifications.length === 0 ? (
          <p className="admin-activity__empty" role="status">
            대기 중이거나 실패한 알림이 없습니다. 전달이 막히면 여기에 표시돼요.
          </p>
        ) : (
          <div className="admin-activity__table-wrap">
            <table aria-label="미전달 알림" className="admin-activity__table">
              <thead>
                <tr>
                  <th scope="col">제목</th>
                  <th scope="col">채널</th>
                  <th scope="col">상태</th>
                  <th scope="col">시도</th>
                  <th scope="col">오류</th>
                  <th scope="col">생성일</th>
                </tr>
              </thead>
              <tbody>
                {model.failedNotifications.map((outbox) => (
                  <tr key={outbox.id}>
                    <td>{outbox.title}</td>
                    <td>{outbox.channelLabel}</td>
                    <td>
                      <Badge tone={outbox.statusTone}>{outbox.statusLabel}</Badge>
                    </td>
                    <td>{outbox.attemptCount}회</td>
                    <td>{outbox.errorCodeLabel}</td>
                    <td>{outbox.createdAtLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  )
}
