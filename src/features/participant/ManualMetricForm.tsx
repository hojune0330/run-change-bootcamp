import { type FormEvent, useId, useRef, useState } from "react"
import { z } from "zod"
import { Button } from "../../components/primitives/index.ts"
import { ActionFeedback } from "./ActionFeedback.tsx"
import { type ActionFeedbackState, rejectedActionFeedback } from "./action-feedback-state.ts"
import { assertParticipantNever, type RecordHandlers } from "./models.ts"

const MANUAL_METRIC_OPTIONS = [
  { key: "distance_km", label: "거리 (km)" },
  { key: "duration_min", label: "운동 시간 (분)" },
  { key: "resting_heart_rate", label: "안정 시 심박수 (bpm)" },
  { key: "sleep_hours", label: "수면 시간 (시간)" },
] as const

const manualMetricSchema = z.object({
  metricKey: z.enum(["distance_km", "duration_min", "resting_heart_rate", "sleep_hours"]),
  value: z.coerce.number().finite().positive(),
  recordedOn: z.iso.date(),
})

type ManualMetricFormProps = {
  readonly handlers: RecordHandlers
  readonly recordedOn: string
}

export function ManualMetricForm({ handlers, recordedOn }: ManualMetricFormProps) {
  const fieldPrefix = useId()
  const [metricKey, setMetricKey] = useState("distance_km")
  const [value, setValue] = useState("")
  const [dateOverride, setDateOverride] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<ActionFeedbackState>()
  const actionPending = useRef(false)
  const date = dateOverride ?? recordedOn

  const saveMetric = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (actionPending.current) {
      return
    }

    const parsed = manualMetricSchema.safeParse({ metricKey, value, recordedOn: date })
    switch (parsed.success) {
      case false:
        setFeedback({ kind: "error", message: "측정값과 날짜를 확인해 주세요." })
        return
      case true: {
        actionPending.current = true
        setBusy(true)
        try {
          const result = await handlers.onSaveManual(parsed.data)
          switch (result.kind) {
            case "success":
              setValue("")
              setDateOverride(undefined)
              setFeedback({ kind: "status", message: "직접 입력한 기록을 저장했어요." })
              break
            case "error":
              setFeedback({ kind: "error", message: result.message })
              break
            default:
              assertParticipantNever(result)
          }
        } catch (error: unknown) {
          const actionError = error instanceof Error ? error : undefined
          setFeedback(
            rejectedActionFeedback(actionError, "기록을 저장하지 못했어요. 다시 시도해 주세요."),
          )
        } finally {
          actionPending.current = false
          setBusy(false)
        }
        break
      }
      default:
        assertParticipantNever(parsed)
    }
  }

  return (
    <form className="participant-form" onSubmit={saveMetric}>
      <div className="participant-field">
        <label htmlFor={`${fieldPrefix}-metric`}>측정 항목</label>
        <select
          id={`${fieldPrefix}-metric`}
          onChange={(event) => setMetricKey(event.currentTarget.value)}
          value={metricKey}
        >
          {MANUAL_METRIC_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="participant-form__grid">
        <div className="participant-field">
          <label htmlFor={`${fieldPrefix}-value`}>측정값</label>
          <input
            id={`${fieldPrefix}-value`}
            inputMode="decimal"
            min="0.01"
            onChange={(event) => setValue(event.currentTarget.value)}
            required
            step="any"
            type="number"
            value={value}
          />
        </div>
        <div className="participant-field">
          <label htmlFor={`${fieldPrefix}-date`}>측정일</label>
          <input
            id={`${fieldPrefix}-date`}
            onChange={(event) => setDateOverride(event.currentTarget.value)}
            required
            type="date"
            value={date}
          />
        </div>
      </div>
      <p className="participant-form__hint">건강 측정값은 저장해도 자동으로 공유되지 않아요.</p>
      <Button busy={busy} type="submit">
        직접 기록 저장
      </Button>
      <ActionFeedback feedback={feedback} />
    </form>
  )
}
