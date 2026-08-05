import { APP_BASE_PATH, toAppPath } from "./base-path.ts"

export const PARTICIPANT_HREFS = ["/today", "/feed", "/record", "/change"] as const
export type ParticipantHref = (typeof PARTICIPANT_HREFS)[number]

export const COACH_HREFS = [
  "/coach/cohort",
  "/coach/assignments",
  "/coach/feedback",
  "/coach/notices",
] as const
export type CoachHref = (typeof COACH_HREFS)[number]

export const ADMIN_HREFS = [
  "/admin/overview",
  "/admin/members",
  "/admin/schedule",
  "/admin/activity",
  "/admin/settings",
] as const
export type AdminHref = (typeof ADMIN_HREFS)[number]

export type AppRoute =
  | { readonly kind: "chooser" }
  | { readonly kind: "about" }
  | { readonly kind: "participant"; readonly href: ParticipantHref }
  | { readonly kind: "coach"; readonly href: CoachHref }
  | { readonly kind: "admin"; readonly href: AdminHref }
  | { readonly kind: "not_found" }

export function resolveRoute(pathname: string, basePath = APP_BASE_PATH): AppRoute {
  const appPath = toAppPath(pathname, basePath)
  if (appPath === "/") return { kind: "chooser" }
  if (appPath === "/about") return { kind: "about" }
  const participant = PARTICIPANT_HREFS.find((href) => href === appPath)
  if (participant !== undefined) return { kind: "participant", href: participant }
  const coach = COACH_HREFS.find((href) => href === appPath)
  if (coach !== undefined) return { kind: "coach", href: coach }
  const admin = ADMIN_HREFS.find((href) => href === appPath)
  if (admin !== undefined) return { kind: "admin", href: admin }
  return { kind: "not_found" }
}
