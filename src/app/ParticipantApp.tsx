import {
  type DemoParticipantId,
  type DemoRepository,
  type DemoState,
  feedModel,
  myChangeModel,
  participantBindings,
  recordModel,
  todayModel,
} from "../demo/index.ts"
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
  readonly href: ParticipantHref
  readonly onNavigate: (href: string) => void
  readonly participantId: DemoParticipantId
  readonly repository: DemoRepository
  readonly state: DemoState
}

export function ParticipantApp({
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
      mode="participant"
      onNavigate={onNavigate}
      sessionLabel={sessionName}
    >
      {href === "/today" ? (
        <TodayScreen
          handlers={bindings.today}
          onRetry={retry}
          state={ready(todayModel(state, participantId))}
        />
      ) : null}
      {href === "/feed" ? (
        <FeedScreen
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
          handlers={bindings.change}
          onRetry={retry}
          state={ready(myChangeModel(state, participantId))}
        />
      ) : null}
    </AppShell>
  )
}
