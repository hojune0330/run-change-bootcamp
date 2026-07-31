export const PARTICIPANT_HREFS = ["/today", "/feed", "/record", "/change"] as const
export type ParticipantHref = (typeof PARTICIPANT_HREFS)[number]

export const COACH_HREFS = [
  "/coach/cohort",
  "/coach/assignments",
  "/coach/feedback",
  "/coach/notices",
] as const
export type CoachHref = (typeof COACH_HREFS)[number]

export type AppRoute =
  | { readonly kind: "chooser" }
  | { readonly kind: "participant"; readonly href: ParticipantHref }
  | { readonly kind: "coach"; readonly href: CoachHref }
  | { readonly kind: "not_found" }

export function resolveRoute(pathname: string): AppRoute {
  if (pathname === "/") return { kind: "chooser" }
  const participant = PARTICIPANT_HREFS.find((href) => href === pathname)
  if (participant !== undefined) return { kind: "participant", href: participant }
  const coach = COACH_HREFS.find((href) => href === pathname)
  if (coach !== undefined) return { kind: "coach", href: coach }
  return { kind: "not_found" }
}
