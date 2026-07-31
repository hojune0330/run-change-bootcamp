import type { CoachFilterViewModel, CohortId } from "./types.ts"
import "./coach-controls.css"

export type CoachFiltersProps = {
  readonly model: CoachFilterViewModel
  readonly onCohortChange: (cohortId: CohortId | "all") => void
  readonly onQueryChange: (query: string) => void
}

export function CoachFilters({ model, onCohortChange, onQueryChange }: CoachFiltersProps) {
  return (
    <search aria-label="참가자 필터">
      <form className="coach-filters" onSubmit={(event) => event.preventDefault()}>
        <label className="coach-field coach-field--search">
          <span>참가자 검색</span>
          <input
            onChange={(event) => onQueryChange(event.currentTarget.value)}
            placeholder="이름 검색"
            type="search"
            value={model.query}
          />
        </label>
        <label className="coach-field">
          <span>코호트</span>
          <select
            onChange={(event) => {
              const value = event.currentTarget.value
              if (value === "all") {
                onCohortChange("all")
                return
              }

              const option = model.cohortOptions.find((item) => item.id === value)
              if (option !== undefined) onCohortChange(option.id)
            }}
            value={model.cohortId}
          >
            <option value="all">전체 코호트</option>
            {model.cohortOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <p aria-live="polite" className="coach-filters__result" role="status">
          {model.resultCount}명 표시
        </p>
      </form>
    </search>
  )
}
