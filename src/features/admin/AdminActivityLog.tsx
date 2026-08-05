import { useState } from "react"
import { Badge, type BadgeTone } from "../../components/primitives/index.ts"
import type { AdminActivityEntry, AdminActivityTone } from "./types.ts"
import "./admin-dashboard.css"

const ACTOR_OPTIONS = [
  { value: "", label: "전체 주체" },
  { value: "coach", label: "코치" },
  { value: "admin", label: "관리자" },
] as const

function badgeTone(tone: AdminActivityTone): BadgeTone {
  switch (tone) {
    case "danger":
      return "critical"
    case "warning":
      return "warning"
    case "success":
      return "success"
    case "default":
      return "neutral"
  }
}

export type AdminActivityLogProps = {
  readonly actionOptions: readonly { readonly value: string; readonly label: string }[]
  readonly entries: readonly AdminActivityEntry[]
}

export function AdminActivityLog({ actionOptions, entries }: AdminActivityLogProps) {
  const [filterActor, setFilterActor] = useState("")
  const [filterAction, setFilterAction] = useState("")

  const filtered = entries.filter(
    (entry) =>
      (filterActor === "" || entry.actor === filterActor) &&
      (filterAction === "" || entry.action === filterAction),
  )

  return (
    <section aria-labelledby="admin-activity-title" className="admin-activity">
      <div className="admin-activity__filters">
        <label className="admin-field">
          <span>주체</span>
          <select
            onChange={(event) => setFilterActor(event.currentTarget.value)}
            value={filterActor}
          >
            {ACTOR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>행동</span>
          <select
            onChange={(event) => setFilterAction(event.currentTarget.value)}
            value={filterAction}
          >
            <option value="">전체 행동</option>
            {actionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <p className="admin-activity__count" role="status">
          {filtered.length}건
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="admin-activity__empty" role="status">
          기록된 활동이 없습니다. 코치가 발행·승인·결정하면 여기에 표시돼요.
        </p>
      ) : (
        <div className="admin-activity__table-wrap">
          <table aria-label="활동 로그" className="admin-activity__table">
            <thead>
              <tr>
                <th scope="col">시각</th>
                <th scope="col">주체</th>
                <th scope="col">행동</th>
                <th scope="col">요약</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.createdAtLabel}</td>
                  <td>{entry.actorLabel}</td>
                  <td>
                    <Badge tone={badgeTone(entry.tone)}>{entry.actionLabel}</Badge>
                  </td>
                  <td>{entry.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
