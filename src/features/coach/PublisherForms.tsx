import { Button, Card } from "../../components/primitives/index.ts"
import type { AssignmentDraft, CohortOption, NoticeDraft } from "./types.ts"
import "./coach-controls.css"

export type AssignmentPublisherProps = {
  readonly cohortOptions: readonly CohortOption[]
  readonly draft: AssignmentDraft
  readonly publishing?: boolean
  readonly onDraftChange: (draft: AssignmentDraft) => void
  readonly onPublish: () => void
}

export function AssignmentPublisher({
  cohortOptions,
  draft,
  onDraftChange,
  onPublish,
  publishing = false,
}: AssignmentPublisherProps) {
  return (
    <Card eyebrow="ASSIGNMENT" title="과제 발행">
      <form
        className="coach-form"
        onSubmit={(event) => {
          event.preventDefault()
          onPublish()
        }}
      >
        <label className="coach-field">
          <span>과제명</span>
          <input
            onChange={(event) => onDraftChange({ ...draft, title: event.currentTarget.value })}
            required
            value={draft.title}
          />
        </label>
        <div className="coach-form__grid">
          <label className="coach-field">
            <span>유형</span>
            <select
              onChange={(event) => {
                const category = event.currentTarget.value
                if (category === "running" || category === "health") {
                  onDraftChange({ ...draft, category })
                }
              }}
              value={draft.category}
            >
              <option value="running">러닝</option>
              <option value="health">건강</option>
            </select>
          </label>
          <label className="coach-field">
            <span>대상</span>
            <select
              onChange={(event) => {
                const cohortId = event.currentTarget.value
                if (cohortId === "all") {
                  onDraftChange({ ...draft, cohortId: "all" })
                  return
                }

                const option = cohortOptions.find((item) => item.id === cohortId)
                if (option !== undefined) onDraftChange({ ...draft, cohortId: option.id })
              }}
              value={draft.cohortId}
            >
              <option value="all">전체 코호트</option>
              {cohortOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="coach-field">
            <span>마감일</span>
            <input
              onChange={(event) => onDraftChange({ ...draft, dueDate: event.currentTarget.value })}
              required
              type="date"
              value={draft.dueDate}
            />
          </label>
        </div>
        <label className="coach-field">
          <span>안내</span>
          <textarea
            onChange={(event) =>
              onDraftChange({ ...draft, instructions: event.currentTarget.value })
            }
            required
            value={draft.instructions}
          />
        </label>
        <div className="coach-form__actions">
          <Button busy={publishing} type="submit">
            과제 발행
          </Button>
        </div>
      </form>
    </Card>
  )
}

export type NoticePublisherProps = {
  readonly draft: NoticeDraft
  readonly publishing?: boolean
  readonly onDraftChange: (draft: NoticeDraft) => void
  readonly onPublish: () => void
}

export function NoticePublisher({
  draft,
  onDraftChange,
  onPublish,
  publishing = false,
}: NoticePublisherProps) {
  return (
    <Card eyebrow="NOTICE" title="공지 발행" tone="muted">
      <form
        className="coach-form"
        onSubmit={(event) => {
          event.preventDefault()
          onPublish()
        }}
      >
        <label className="coach-field">
          <span>제목</span>
          <input
            onChange={(event) => onDraftChange({ ...draft, title: event.currentTarget.value })}
            required
            value={draft.title}
          />
        </label>
        <label className="coach-field">
          <span>내용</span>
          <textarea
            onChange={(event) => onDraftChange({ ...draft, body: event.currentTarget.value })}
            required
            value={draft.body}
          />
        </label>
        <div className="coach-form__actions">
          <label className="coach-checkbox">
            <input
              checked={draft.pinned}
              onChange={(event) => onDraftChange({ ...draft, pinned: event.currentTarget.checked })}
              type="checkbox"
            />
            <span>상단 고정</span>
          </label>
          <Button busy={publishing} type="submit">
            공지 발행
          </Button>
        </div>
      </form>
    </Card>
  )
}
