import type { MouseEvent, ReactNode } from "react"
import { useLayoutEffect, useRef } from "react"
import { BrandLogo } from "../components/BrandLogo.tsx"
import { Badge } from "../components/primitives/index.ts"
import { type BrandConfig, DEFAULT_BRAND } from "../design/brand-config.ts"
import "./AppShell.css"
import { toBrowserPath } from "./base-path.ts"
import { type AppMode, MODE_LABELS, MODE_SWITCH_LINKS, NAVIGATION_BY_MODE } from "./navigation.tsx"

export type AppShellProps = {
  readonly activeHref: string
  readonly brand?: BrandConfig
  readonly children: ReactNode
  readonly mode: AppMode
  readonly onNavigate?: (href: string) => void
  readonly provenanceLabel?: string
  readonly sessionLabel?: string
}

export function AppShell({
  activeHref,
  brand = DEFAULT_BRAND,
  children,
  mode,
  onNavigate,
  provenanceLabel,
  sessionLabel = "8주 과정",
}: AppShellProps) {
  const navigationItems = NAVIGATION_BY_MODE[mode]
  const modeSwitchLink = MODE_SWITCH_LINKS[mode]
  const mainRef = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const main = mainRef.current
    if (main?.getAttribute("data-active-route") !== activeHref) return
    main.focus({ preventScroll: true })
  }, [activeHref])

  const navigate = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (onNavigate === undefined) return
    event.preventDefault()
    onNavigate(href)
  }

  return (
    <div
      className="app-shell"
      data-brand-tenant={brand.tenantId}
      data-mode={mode}
      data-product={brand.productName}
    >
      <a className="app-shell__skip-link" href="#main-content">
        본문으로 건너뛰기
      </a>
      <header className="app-shell__header">
        <a
          aria-label={`${brand.productName} 홈`}
          className="app-shell__brand"
          href={toBrowserPath("/")}
          onClick={(event) => navigate(event, "/")}
        >
          <BrandLogo brand={brand} className="app-shell__brand-logo" />
          <span className="app-shell__brand-name">
            <strong>{brand.tenantName}</strong>
            <small>{brand.productName}</small>
          </span>
        </a>
        <div className="app-shell__header-actions">
          {provenanceLabel === undefined ? null : (
            <span className="app-shell__provenance" data-demo-provenance>
              <Badge tone="warning">{provenanceLabel}</Badge>
            </span>
          )}
          <span className="app-shell__session-badge">
            <Badge tone="neutral">{sessionLabel}</Badge>
          </span>
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
        aria-label={brand.labels.shell}
        data-active-route={activeHref}
        data-brand-shell-label={brand.labels.shell}
        className="app-shell__main"
        id="main-content"
        ref={mainRef}
        key={activeHref}
        tabIndex={-1}
      >
        <div className="app-shell__content">{children}</div>
      </main>
    </div>
  )
}
