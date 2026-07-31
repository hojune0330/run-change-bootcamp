import type { ButtonHTMLAttributes, ReactNode } from "react"
import "./primitives.css"

export const BUTTON_VARIANTS = ["primary", "secondary", "quiet"] as const
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number]

export type ButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "className"
> & {
  readonly busy?: boolean
  readonly children: ReactNode
  readonly icon?: ReactNode
  readonly variant?: ButtonVariant
}

export function Button({
  busy = false,
  children,
  disabled = false,
  icon,
  type = "button",
  variant = "primary",
  ...buttonProps
}: ButtonProps) {
  return (
    <button
      {...buttonProps}
      aria-busy={busy}
      className={`button button--${variant}`}
      disabled={disabled || busy}
      type={type}
    >
      {icon === undefined ? null : <span className="button__icon">{icon}</span>}
      <span>{children}</span>
    </button>
  )
}
