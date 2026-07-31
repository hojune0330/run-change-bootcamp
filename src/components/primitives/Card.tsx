import { type ReactNode, useId } from "react"
import "./primitives.css"

export const CARD_TONES = ["default", "muted"] as const
export type CardTone = (typeof CARD_TONES)[number]

export type CardProps = {
  readonly action?: ReactNode
  readonly children: ReactNode
  readonly eyebrow?: string
  readonly id?: string
  readonly title: string
  readonly tone?: CardTone
}

export function Card({ action, children, eyebrow, id, title, tone = "default" }: CardProps) {
  const generatedTitleId = useId()
  const titleId = id === undefined ? generatedTitleId : `${id}-title`

  return (
    <section aria-labelledby={titleId} className={`card card--${tone}`} id={id}>
      <div className="card__header">
        <div className="card__heading">
          {eyebrow === undefined ? null : <p className="card__eyebrow">{eyebrow}</p>}
          <h2 className="card__title" id={titleId}>
            {title}
          </h2>
        </div>
        {action === undefined ? null : <div className="card__action">{action}</div>}
      </div>
      <div className="card__body">{children}</div>
    </section>
  )
}
