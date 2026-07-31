import { useRef, useState } from "react"
import { Badge, Card } from "../../components/primitives/index.ts"
import { ActionFeedback } from "./ActionFeedback.tsx"
import { type ActionFeedbackState, rejectedActionFeedback } from "./action-feedback-state.ts"
import {
  assertParticipantNever,
  type ConsentAuditViewModel,
  type ConsentViewModel,
  type MyChangeHandlers,
} from "./models.ts"

type ConsentToggleProps = {
  readonly handlers: MyChangeHandlers
  readonly item: ConsentViewModel
  readonly onAudit: (entry: ConsentAuditViewModel) => void
}

type ConsentUpdate = {
  readonly key: ConsentViewModel["key"]
  readonly sourceEnabled: boolean
  readonly enabled: boolean
}

function ConsentToggle({ handlers, item, onAudit }: ConsentToggleProps) {
  const [consentUpdate, setConsentUpdate] = useState<ConsentUpdate>()
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<ActionFeedbackState>()
  const actionPending = useRef(false)
  const sourceEnabled = item.enabled ?? false
  const enabled =
    consentUpdate?.key === item.key && consentUpdate.sourceEnabled === sourceEnabled
      ? consentUpdate.enabled
      : sourceEnabled
  const hasCurrentConsentUpdate =
    consentUpdate?.key === item.key && consentUpdate.sourceEnabled === sourceEnabled
  if (consentUpdate !== undefined && !hasCurrentConsentUpdate) {
    setConsentUpdate(undefined)
  }

  const changeConsent = async () => {
    if (actionPending.current) {
      return
    }
    actionPending.current = true
    setBusy(true)
    const nextEnabled = !enabled
    try {
      const result = await handlers.onConsentChange({ key: item.key, enabled: nextEnabled })
      switch (result.kind) {
        case "success":
          setConsentUpdate({ key: item.key, sourceEnabled, enabled: nextEnabled })
          onAudit(result.auditEntry)
          setFeedback({
            kind: "status",
            message: nextEnabled ? "공유를 허용했어요." : "공유를 철회했어요.",
          })
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
        rejectedActionFeedback(actionError, "공유 설정을 바꾸지 못했어요. 다시 시도해 주세요."),
      )
    } finally {
      actionPending.current = false
      setBusy(false)
    }
  }

  return (
    <li className="participant-consent-item">
      <div className="participant-consent-copy">
        <strong>{item.label}</strong>
        <span>{item.description}</span>
      </div>
      <button
        aria-checked={enabled}
        aria-label={item.label}
        className="participant-switch"
        disabled={busy}
        onClick={changeConsent}
        role="switch"
        type="button"
      >
        <span aria-hidden>{enabled ? "켜짐" : "꺼짐"}</span>
      </button>
      <ActionFeedback feedback={feedback} />
    </li>
  )
}

type ConsentControlsProps = {
  readonly consents: readonly ConsentViewModel[]
  readonly handlers: MyChangeHandlers
  readonly history: readonly ConsentAuditViewModel[]
}

export function ConsentControls({ consents, handlers, history }: ConsentControlsProps) {
  const [localAuditHistory, setLocalAuditHistory] = useState<readonly ConsentAuditViewModel[]>([])
  const auditHistory = [
    ...history,
    ...localAuditHistory.filter((entry) => history.every((item) => item.id !== entry.id)),
  ]

  return (
    <Card
      action={<Badge tone="neutral">기본 비공개</Badge>}
      eyebrow="PRIVACY"
      title="건강 정보 공유"
    >
      <div className="participant-stack">
        <p className="participant-source-note">
          항목별로 필요할 때만 켜세요. 언제든 다시 끌 수 있어요.
        </p>
        {consents.length === 0 ? (
          <p className="participant-empty-copy">공유할 건강 항목이 없어요.</p>
        ) : (
          <ul className="participant-consent-list">
            {consents.map((item) => (
              <ConsentToggle
                handlers={handlers}
                item={item}
                key={item.key}
                onAudit={(entry) => setLocalAuditHistory((current) => [...current, entry])}
              />
            ))}
          </ul>
        )}
        <section aria-label="공유 변경 기록" className="participant-audit-region">
          <h3>공유 변경 기록</h3>
          {auditHistory.length === 0 ? (
            <p className="participant-empty-copy">아직 변경한 내역이 없어요.</p>
          ) : (
            <ul>
              {auditHistory.map((entry) => (
                <li key={entry.id}>{entry.label}</li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Card>
  )
}
