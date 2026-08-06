import { Badge, type BadgeTone } from "../../components/primitives/index.ts"
import type { AdminMemberRosterRow, AdminMembersViewModel } from "./types.ts"
import "./admin-dashboard.css"

export type AdminMemberRosterProps = {
  readonly model: AdminMembersViewModel
}

function statusTone(status: AdminMemberRosterRow["status"]): BadgeTone {
  return status === "active" ? "success" : status === "paused" ? "warning" : "neutral"
}

export function AdminMemberRoster({ model }: AdminMemberRosterProps) {
  return (
    <section aria-label="관리자 멤버 명부" className="admin-dashboard">
      <header className="admin-dashboard__header">
        <div>
          <p className="admin-dashboard__eyebrow">전체 명부 · {model.dateRangeLabel}</p>
          <h1>{model.programName}</h1>
          <span>프로그램 멤버의 역할·상태·진척도와 건강 공유 현황을 확인합니다.</span>
        </div>
        <Badge tone="success">멤버 명부</Badge>
      </header>

      <ul aria-label="멤버 현황" className="admin-kpis">
        <li className="admin-kpi">
          <span>전체 멤버</span>
          <strong>{model.summary.totalMembers}명</strong>
          <small>프로그램 소속</small>
        </li>
        <li className="admin-kpi">
          <span>활동 참여자</span>
          <strong>{model.summary.activeParticipants}명</strong>
          <small>참여자·활동 중</small>
        </li>
        <li className="admin-kpi">
          <span>운영 코치</span>
          <strong>{model.summary.activeCoaches}명</strong>
          <small>코치·활동 중</small>
        </li>
        <li className="admin-kpi">
          <span>건강 공유</span>
          <strong>{model.summary.consentedCount}명</strong>
          <small>심박수 동의</small>
        </li>
      </ul>

      {model.members.length === 0 ? (
        <p className="admin-activity__empty" role="status">
          아직 등록된 멤버가 없습니다. 초대가 완료되면 여기에 표시돼요.
        </p>
      ) : (
        <div className="admin-activity__table-wrap">
          <table aria-label="멤버 명부" className="admin-activity__table">
            <thead>
              <tr>
                <th scope="col">이름</th>
                <th scope="col">이메일</th>
                <th scope="col">역할</th>
                <th scope="col">상태</th>
                <th scope="col">참여일</th>
                <th scope="col">진척도</th>
                <th scope="col">공유</th>
              </tr>
            </thead>
            <tbody>
              {model.members.map((member) => (
                <tr key={member.id}>
                  <td>{member.name}</td>
                  <td>{member.email ?? "—"}</td>
                  <td>
                    <Badge tone="neutral">{member.roleLabel}</Badge>
                  </td>
                  <td>
                    <Badge tone={statusTone(member.status)}>{member.statusLabel}</Badge>
                  </td>
                  <td>{member.joinedAtLabel}</td>
                  <td>
                    {member.completionPercent}% · {member.progressLabel}
                  </td>
                  <td>
                    <Badge tone={member.shareTone}>{member.shareLabel}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
