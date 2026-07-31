import { useEffect } from "react"
import { coachBindings, coachModel, type DemoRepository, type DemoState } from "../demo/index.ts"
import { CoachDashboard } from "../features/coach/index.ts"
import { AppShell } from "./AppShell.tsx"
import type { CoachHref } from "./routes.ts"

type CoachAppProps = {
  readonly href: CoachHref
  readonly onNavigate: (href: string) => void
  readonly repository: DemoRepository
  readonly state: DemoState
}

function routeControl(href: CoachHref): HTMLElement | null {
  const publisherForms = document.querySelectorAll<HTMLFormElement>(
    ".coach-dashboard__publishers form",
  )
  switch (href) {
    case "/coach/cohort":
      return document.querySelector<HTMLInputElement>('search input[type="search"]')
    case "/coach/assignments":
      return publisherForms.item(0).querySelector<HTMLElement>("input, select, textarea, button")
    case "/coach/feedback":
      return document.querySelector<HTMLElement>(".coach-dashboard__review button")
    case "/coach/notices":
      return publisherForms.item(1).querySelector<HTMLElement>("input, select, textarea, button")
  }
}

export function CoachApp({ href, onNavigate, repository, state }: CoachAppProps) {
  useEffect(() => {
    const target = routeControl(href)
    if (target === null) return
    if (typeof target.scrollIntoView === "function") target.scrollIntoView({ block: "center" })
    target.focus({ preventScroll: true })
  }, [href])

  return (
    <AppShell activeHref={href} mode="coach" onNavigate={onNavigate} sessionLabel="김 코치">
      <CoachDashboard handlers={coachBindings(repository)} model={coachModel(state)} />
    </AppShell>
  )
}
