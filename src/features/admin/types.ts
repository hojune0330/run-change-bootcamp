import type { ActivityAction } from "../../demo/state.ts"

export type AdminKpi = {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly hint: string
}

export type AdminActivityTone = "success" | "warning" | "danger" | "default"

export type AdminActivityEntry = {
  readonly id: string
  readonly actor: "coach" | "admin"
  readonly actorLabel: string
  readonly action: ActivityAction
  readonly actionLabel: string
  readonly tone: AdminActivityTone
  readonly summary: string
  readonly createdAtLabel: string
}

export type AdminMemberRow = {
  readonly id: string
  readonly name: string
  readonly cohortLabel: string
  readonly completionPercent: number
  readonly progressLabel: string
  readonly shareLabel: string
  readonly shareTone: "success" | "warning" | "neutral"
}

export type AdminDashboardViewModel = {
  readonly programName: string
  readonly dateRangeLabel: string
  readonly operationStatusLabel: string
  readonly timeTrialLabel: string
  readonly consentedCount: number
  readonly assignmentsCount: number
  readonly kpis: readonly AdminKpi[]
  readonly activity: readonly AdminActivityEntry[]
  readonly recentActivity: readonly AdminActivityEntry[]
  readonly actionOptions: readonly { readonly value: string; readonly label: string }[]
  readonly members: readonly AdminMemberRow[]
}
