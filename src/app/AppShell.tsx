import type { MouseEvent, ReactNode } from "react"
import { Badge } from "../components/primitives/index.ts"
import "./AppShell.css"
import { toBrowserPath } from "./base-path.ts"
import { type AppMode, MODE_LABELS, MODE_SWITCH_LINKS, NAVIGATION_BY_MODE } from "./navigation.tsx"

export type AppShellProps = {
  readonly activeHref: string
  readonly children: ReactNode
  readonly mode: AppMode
  readonly onNavigate?: (href: string) => void
  readonly sessionLabel?: string
}

export function AppShell({
  activeHref,
  children,
  mode,
  onNavigate,
  sessionLabel = "8주 과정",
}: AppShellProps) {
  const navigationItems = NAVIGATION_BY_MODE[mode]
  const modeSwitchLink = MODE_SWITCH_LINKS[mode]
  const navigate = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (onNavigate === undefined) return
    event.preventDefault()
    onNavigate(href)
  }

  return (
    <div className="app-shell">
      <a className="app-shell__skip-link" href="#main-content">
        본문으로 건너뛰기
      </a>
      <header className="app-shell__header">
        <a
          aria-label="RUN CHANGE 홈"
          className="app-shell__brand"
          href={toBrowserPath("/")}
          onClick={(event) => navigate(event, "/")}
        >
          <span>RUN</span>
          <span>CHANGE</span>
        </a>
        <div className="app-shell__header-actions">
          <Badge tone="neutral">{sessionLabel}</Badge>
          <a
            className="app-shell__mode-switch"
            href={toBrowserPath(modeSwitchLink.href)}
            onClick={(event) => navigate(event, modeSwitchLink.href)}
          >
            {modeSwitchLink.label}
          </a>
        </div>
      </header>
      <nav aria-label={MODE_LABELS[mode]} className="app-shell__navigation">
        <ul className="app-shell__navigation-list">
          {navigationItems.map((item) => {
            const isCurrent = item.href === activeHref

            return (
              <li key={item.href}>
                <a
                  aria-current={isCurrent ? "page" : undefined}
                  className="app-shell__navigation-link"
                  href={toBrowserPath(item.href)}
                  onClick={(event) => navigate(event, item.href)}
                >
                  <span className="app-shell__navigation-icon">{item.icon}</span>
                  <span className="app-shell__navigation-label">{item.label}</span>
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
      <main
        aria-label="RUN CHANGE 콘텐츠"
        className="app-shell__main"
        id="main-content"
        key={activeHref}
        tabIndex={-1}
      >
        <div className="app-shell__content">{children}</div>
      </main>
    </div>
  )
}
