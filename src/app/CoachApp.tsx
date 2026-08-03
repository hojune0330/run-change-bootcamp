import { useEffect } from "react"
import { coachBindings, coachModel, type DemoRepository, type DemoState } from "../demo/index.ts"
import { type BrandConfig, DEFAULT_BRAND } from "../design/brand-config.ts"
import { CoachDashboard } from "../features/coach/index.ts"
import { AppShell } from "./AppShell.tsx"
import type { CoachHref } from "./routes.ts"

type CoachAppProps = {
  readonly brand?: BrandConfig
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

export function CoachApp({
  brand = DEFAULT_BRAND,
  href,
  onNavigate,
  repository,
  state,
}: CoachAppProps) {
  const model = coachModel(state)
  const brandedModel = {
    ...model,
    programName: `${brand.productName} 2026`,
    cohortOptions: model.cohortOptions.map((option) => ({
      ...option,
      label: option.label.replace("RUN CHANGE", brand.productName),
    })),
    participants: model.participants.map((participant) => ({
      ...participant,
      cohortLabel: participant.cohortLabel.replace("RUN CHANGE", brand.productName),
    })),
    ...(model.selectedParticipant === undefined
      ? {}
      : {
          selectedParticipant: {
            ...model.selectedParticipant,
            cohortLabel: model.selectedParticipant.cohortLabel.replace(
              "RUN CHANGE",
              brand.productName,
            ),
          },
        }),
  }
  useEffect(() => {
    const target = routeControl(href)
    if (target === null) return
    if (typeof target.scrollIntoView === "function") target.scrollIntoView({ block: "nearest" })
    target.focus({ preventScroll: true })
  }, [href])

  return (
    <AppShell
      activeHref={href}
      brand={brand}
      mode="coach"
      onNavigate={onNavigate}
      sessionLabel={`${brand.productName} 코치`}
    >
      <CoachDashboard handlers={coachBindings(repository)} model={brandedModel} />
    </AppShell>
  )
}
