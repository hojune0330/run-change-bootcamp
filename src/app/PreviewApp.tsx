import { useEffect, useState, useSyncExternalStore } from "react"
import { createDemoRepository } from "../demo/index.ts"
import { toAppPath, toBrowserPath } from "./base-path.ts"
import { CoachApp } from "./CoachApp.tsx"
import { DemoSessionChooser } from "./DemoSessionChooser.tsx"
import { ParticipantApp } from "./ParticipantApp.tsx"
import { resolveRoute } from "./routes.ts"

export function PreviewApp() {
  const [repository] = useState(() => createDemoRepository(window.localStorage))
  const state = useSyncExternalStore(repository.subscribe, repository.getSnapshot)
  const [pathname, setPathname] = useState(() => toAppPath(window.location.pathname))
  useEffect(() => {
    const syncPath = () => setPathname(toAppPath(window.location.pathname))
    window.addEventListener("popstate", syncPath)
    return () => window.removeEventListener("popstate", syncPath)
  }, [])
  const navigate = (href: string) => {
    const browserPath = toBrowserPath(href)
    window.history.pushState({}, "", browserPath)
    setPathname(toAppPath(browserPath))
  }
  const route = resolveRoute(pathname)

  switch (route.kind) {
    case "chooser":
    case "not_found":
      return <DemoSessionChooser onNavigate={navigate} repository={repository} />
    case "participant":
      return state.session?.role === "participant" ? (
        <ParticipantApp
          href={route.href}
          onNavigate={navigate}
          participantId={state.session.participantId}
          repository={repository}
          state={state}
        />
      ) : (
        <DemoSessionChooser onNavigate={navigate} repository={repository} />
      )
    case "coach":
      return state.session?.role === "coach" ? (
        <CoachApp href={route.href} onNavigate={navigate} repository={repository} state={state} />
      ) : (
        <DemoSessionChooser onNavigate={navigate} repository={repository} />
      )
  }
}
