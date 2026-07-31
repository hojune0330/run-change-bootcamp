import type { ReactNode } from "react"
import "./primitives.css"

export const BADGE_TONES = ["neutral", "success", "warning", "critical"] as const
export type BadgeTone = (typeof BADGE_TONES)[number]

export type BadgeProps = {
  readonly children: ReactNode
  readonly tone?: BadgeTone
}

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}
