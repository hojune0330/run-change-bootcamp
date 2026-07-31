import { type ReactNode, useEffect, useRef } from "react"
import { Button, Card } from "../../components/primitives/index.ts"
import { assertParticipantNever, type Loadable } from "./models.ts"
import "./participant.css"

type LoadableBoundaryProps<T> = {
  readonly children: (data: T) => ReactNode
  readonly onRetry: () => void
  readonly state: Loadable<T>
}

export function LoadableBoundary<T>({ children, onRetry, state }: LoadableBoundaryProps<T>) {
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (state.status === "error") {
      errorRef.current?.focus()
    }
  }, [state.status])

  switch (state.status) {
    case "loading":
      return (
        <Card title="잠시만 기다려 주세요" tone="muted">
          <p aria-live="polite" className="participant-state-copy" role="status">
            필요한 기록을 불러오는 중이에요.
          </p>
        </Card>
      )
    case "error":
      return (
        <div ref={errorRef} role="alert" tabIndex={-1}>
          <Card title="불러오지 못했어요" tone="muted">
            <div className="participant-state-stack">
              <p className="participant-state-copy">{state.message}</p>
              <Button onClick={onRetry} variant="secondary">
                다시 시도
              </Button>
            </div>
          </Card>
        </div>
      )
    case "ready":
      return children(state.data)
    default:
      return assertParticipantNever(state)
  }
}
