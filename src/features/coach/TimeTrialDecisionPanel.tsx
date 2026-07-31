import { Badge, Button, Card } from "../../components/primitives/index.ts"
import type {
  TimeTrialDecision,
  TimeTrialDraft,
  TimeTrialProtocol,
  TimeTrialSession,
  TimeTrialViewModel,
} from "./types.ts"
import "./coach-decision.css"

export type TimeTrialConsequences = {
  readonly sessionOne: string
  readonly sessionTwo: string
  readonly weekEight: string
}

const SESSION_OPTIONS = [
  { value: "session_1", label: "1회차" },
  { value: "session_2", label: "2회차" },
] as const

const PROTOCOL_OPTIONS = [
  { value: "12_minute", label: "12분" },
  { value: "3k", label: "3K" },
  { value: "5k", label: "5K" },
] as const

function protocolLabel(protocol: TimeTrialProtocol): string {
  switch (protocol) {
    case "12_minute":
      return "12분"
    case "3k":
      return "3K"
    case "5k":
      return "5K"
  }
}

export function buildTimeTrialConsequences(draft: TimeTrialDraft): TimeTrialConsequences | null {
  if (draft.session === null || draft.protocol === null) return null

  const protocol = protocolLabel(draft.protocol)
  switch (draft.session) {
    case "session_1":
      return {
        sessionOne: `${protocol} 첫 기록 측정`,
        sessionTwo: "회복 · 러닝 기술",
        weekEight: `8주차 ${protocol} 동일 프로토콜 재측정`,
      }
    case "session_2":
      return {
        sessionOne: "오리엔테이션 · 이지런",
        sessionTwo: `${protocol} 첫 기록 측정`,
        weekEight: `8주차 ${protocol} 동일 프로토콜 재측정`,
      }
  }
}

export type TimeTrialDecisionPanelProps = {
  readonly model: TimeTrialViewModel
  readonly onCancelChange: () => void
  readonly onConfirmChange: (decision: TimeTrialDecision) => void
  readonly onDraftProtocolChange: (protocol: TimeTrialProtocol) => void
  readonly onDraftSessionChange: (session: TimeTrialSession) => void
  readonly onRequestChangeConfirmation: (decision: TimeTrialDecision) => void
  readonly onSave: (decision: TimeTrialDecision) => void
}

type DecidedTimeTrial = Extract<TimeTrialDecision, { readonly kind: "decided" }>

function draftDecision(draft: TimeTrialDraft): DecidedTimeTrial | null {
  if (draft.session === null || draft.protocol === null) return null
  return { kind: "decided", session: draft.session, protocol: draft.protocol }
}

function sameDecision(current: TimeTrialDecision, next: DecidedTimeTrial): boolean {
  switch (current.kind) {
    case "undecided":
      return false
    case "decided":
      return current.session === next.session && current.protocol === next.protocol
  }
}

export function TimeTrialDecisionPanel({
  model,
  onCancelChange,
  onConfirmChange,
  onDraftProtocolChange,
  onDraftSessionChange,
  onRequestChangeConfirmation,
  onSave,
}: TimeTrialDecisionPanelProps) {
  const nextDecision = draftDecision(model.draft)
  const consequences = buildTimeTrialConsequences(model.draft)
  const isExistingDecision = model.currentDecision.kind === "decided"
  const isUnchanged =
    nextDecision === null ? false : sameDecision(model.currentDecision, nextDecision)

  return (
    <Card
      action={
        <Badge tone={isExistingDecision ? "success" : "warning"}>
          {isExistingDecision ? "결정 완료" : "미정"}
        </Badge>
      }
      eyebrow="TIME TRIAL"
      title="첫 기록 측정 결정"
      tone="muted"
    >
      <p className="coach-decision__intro">
        측정 회차와 프로토콜을 정하면 두 회차 구성과 8주차 재측정이 함께 고정됩니다.
      </p>
      <form
        aria-label="첫 기록 측정 결정"
        className="coach-decision"
        onSubmit={(event) => {
          event.preventDefault()
          if (nextDecision === null) return

          if (isExistingDecision && !isUnchanged) {
            onRequestChangeConfirmation(nextDecision)
            return
          }

          onSave(nextDecision)
        }}
      >
        <fieldset>
          <legend>측정 회차</legend>
          <div className="coach-choice-grid">
            {SESSION_OPTIONS.map((option) => (
              <label className="coach-choice" key={option.value}>
                <input
                  checked={model.draft.session === option.value}
                  name="time-trial-session"
                  onChange={() => onDraftSessionChange(option.value)}
                  type="radio"
                  value={option.value}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.value === "session_1" ? "첫날 측정" : "둘째 날 측정"}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>프로토콜</legend>
          <div className="coach-choice-grid coach-choice-grid--protocol">
            {PROTOCOL_OPTIONS.map((option) => (
              <label className="coach-choice" key={option.value}>
                <input
                  checked={model.draft.protocol === option.value}
                  name="time-trial-protocol"
                  onChange={() => onDraftProtocolChange(option.value)}
                  type="radio"
                  value={option.value}
                />
                <span>
                  <strong>{option.label}</strong>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <section
          aria-labelledby="decision-preview-title"
          aria-live="polite"
          className="coach-preview"
        >
          <h3 id="decision-preview-title">운영 결과 미리보기</h3>
          {consequences === null ? (
            <p>회차와 프로토콜을 모두 선택하면 일정이 표시됩니다.</p>
          ) : (
            <ol>
              <li>
                <span>1회차</span>
                <strong>{consequences.sessionOne}</strong>
              </li>
              <li>
                <span>2회차</span>
                <strong>{consequences.sessionTwo}</strong>
              </li>
              <li>
                <span>8주차</span>
                <strong>{consequences.weekEight}</strong>
              </li>
            </ol>
          )}
        </section>

        {model.confirmation.kind === "required" && nextDecision !== null ? (
          <div className="coach-decision__confirmation" role="alert">
            <p>기존 결정을 바꾸면 회차 일정과 재측정 계획도 함께 변경됩니다.</p>
            <div>
              <Button onClick={onCancelChange} variant="quiet">
                취소
              </Button>
              <Button onClick={() => onConfirmChange(nextDecision)}>변경 확정</Button>
            </div>
          </div>
        ) : null}

        <div className="coach-decision__save">
          <Button disabled={nextDecision === null || isUnchanged} type="submit">
            {isExistingDecision ? "결정 변경" : "결정 저장"}
          </Button>
        </div>
      </form>
    </Card>
  )
}
