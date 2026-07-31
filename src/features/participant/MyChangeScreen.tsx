import { Card } from "../../components/primitives/index.ts"
import { ConsentControls } from "./ConsentControls.tsx"
import { FeedbackPanel } from "./FeedbackPanel.tsx"
import { LoadableBoundary } from "./LoadableBoundary.tsx"
import type { Loadable, MyChangeHandlers, MyChangeViewModel } from "./models.ts"
import "./participant.css"

export type MyChangeScreenProps = {
  readonly state: Loadable<MyChangeViewModel>
  readonly handlers: MyChangeHandlers
  readonly onRetry: () => void
}

export function MyChangeScreen({ state, handlers, onRetry }: MyChangeScreenProps) {
  return (
    <section aria-labelledby="participant-change-title" className="participant-screen">
      <header className="participant-screen__header">
        <p className="participant-screen__eyebrow">MY CHANGE</p>
        <h1 id="participant-change-title">내 변화</h1>
      </header>
      <LoadableBoundary onRetry={onRetry} state={state}>
        {(model) => (
          <div className="participant-screen__content">
            <div className="participant-greeting">
              <p className="participant-greeting__name">{model.displayName}의 기록</p>
              <p>매일보다 주간 변화를 천천히 확인해요.</p>
            </div>

            <Card eyebrow="PROGRESS" title="기록 변화" tone="muted">
              {model.metrics.length === 0 ? (
                <p className="participant-empty-copy">아직 비교할 기록이 없어요.</p>
              ) : (
                <dl className="participant-metric-list">
                  {model.metrics.map((metric) => (
                    <div key={metric.id}>
                      <dt>{metric.label}</dt>
                      <dd>
                        <strong>{metric.value}</strong>
                        <span>{metric.changeLabel}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </Card>

            <FeedbackPanel feedback={model.feedback} />
            <ConsentControls
              consents={model.consents}
              handlers={handlers}
              history={model.consentHistory}
            />
          </div>
        )}
      </LoadableBoundary>
    </section>
  )
}
