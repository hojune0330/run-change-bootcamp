import {
  DEMO_DATA_PROVENANCE_LABEL,
  type DemoParticipantId,
  type DemoRepository,
  type DemoState,
  feedModel,
  myChangeModel,
  participantBindings,
  recordModel,
  todayModel,
} from "../demo/index.ts"
import { type BrandConfig, DEFAULT_BRAND } from "../design/brand-config.ts"
import {
  FeedScreen,
  MyChangeScreen,
  RecordScreen,
  TodayScreen,
} from "../features/participant/index.ts"
import { DEMO_PARTICIPANTS } from "../fixtures/index.ts"
import { AppShell } from "./AppShell.tsx"
import type { ParticipantHref } from "./routes.ts"

type ParticipantAppProps = {
  readonly brand?: BrandConfig
  readonly href: ParticipantHref
  readonly onNavigate: (href: string) => void
  readonly participantId: DemoParticipantId
  readonly repository: DemoRepository
  readonly state: DemoState
}

export function ParticipantApp({
  brand = DEFAULT_BRAND,
  href,
  onNavigate,
  participantId,
  repository,
  state,
}: ParticipantAppProps) {
  const bindings = participantBindings(repository, participantId)
  const sessionName =
    DEMO_PARTICIPANTS.find((participant) => participant.id === participantId)?.displayName ??
    "참여자"
  const ready = <T,>(data: T) => ({ status: "ready", data }) as const
  const retry = () => repository.reset()

  return (
    <AppShell
      activeHref={href}
      brand={brand}
      mode="participant"
      onNavigate={onNavigate}
      provenanceLabel={DEMO_DATA_PROVENANCE_LABEL}
      sessionLabel={sessionName}
    >
      {href === "/today" ? (
        <TodayScreen
          brand={brand}
          handlers={bindings.today}
          onRetry={retry}
          state={ready(todayModel(state, participantId))}
        />
      ) : null}
      {href === "/feed" ? (
        <FeedScreen
          brand={brand}
          handlers={bindings.feed}
          onRetry={retry}
          shareServices={bindings.share}
          state={ready(feedModel(state, participantId))}
        />
      ) : null}
      {href === "/record" ? (
        <RecordScreen handlers={bindings.record} onRetry={retry} state={ready(recordModel())} />
      ) : null}
      {href === "/change" ? (
        <MyChangeScreen
          brand={brand}
          handlers={bindings.change}
          onRetry={retry}
          state={ready(myChangeModel(state, participantId))}
        />
      ) : null}
    </AppShell>
  )
}
