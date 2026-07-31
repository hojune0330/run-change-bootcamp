import type { AnchorHTMLAttributes, ReactNode } from "react"
import "./primitives.css"
import type { ButtonVariant } from "./Button.tsx"

export type ActionLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "children" | "className" | "href"
> & {
  readonly children: ReactNode
  readonly href: string
  readonly icon?: ReactNode
  readonly variant?: ButtonVariant
}

export function ActionLink({
  children,
  href,
  icon,
  variant = "primary",
  ...anchorProps
}: ActionLinkProps) {
  return (
    <a {...anchorProps} className={`button button--${variant}`} href={href}>
      {icon === undefined ? null : <span className="button__icon">{icon}</span>}
      <span>{children}</span>
    </a>
  )
}
