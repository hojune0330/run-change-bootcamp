import { useEffect, useState, useSyncExternalStore } from "react"
import { createDemoRepository } from "../demo/index.ts"
import { type BrandConfig, DEFAULT_BRAND } from "../design/brand-config.ts"
import { AboutPage } from "./AboutPage.tsx"
import { AdminApp } from "./AdminApp.tsx"
import { toAppPath, toBrowserPath } from "./base-path.ts"
import { CoachApp } from "./CoachApp.tsx"
import { DemoSessionChooser } from "./DemoSessionChooser.tsx"
import { ParticipantApp } from "./ParticipantApp.tsx"
import { resolveRoute } from "./routes.ts"

type PreviewAppProps = {
  readonly brand?: BrandConfig
}

export function PreviewApp({ brand = DEFAULT_BRAND }: PreviewAppProps = {}) {
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
    case "about":
      return <AboutPage brand={brand} onNavigate={navigate} />
    case "chooser":
    case "not_found":
      return <DemoSessionChooser brand={brand} onNavigate={navigate} repository={repository} />
    case "participant":
      return state.session?.role === "participant" ? (
        <ParticipantApp
          brand={brand}
          href={route.href}
          onNavigate={navigate}
          participantId={state.session.participantId}
          repository={repository}
          state={state}
        />
      ) : (
        <DemoSessionChooser brand={brand} onNavigate={navigate} repository={repository} />
      )
    case "coach":
      return state.session?.role === "coach" ? (
        <CoachApp
          brand={brand}
          href={route.href}
          onNavigate={navigate}
          repository={repository}
          state={state}
        />
      ) : (
        <DemoSessionChooser brand={brand} onNavigate={navigate} repository={repository} />
      )
    case "admin":
      return <AdminApp brand={brand} href={route.href} onNavigate={navigate} />
  }
}
