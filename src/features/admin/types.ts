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

export type AdminMemberRosterRow = {
  readonly id: string
  readonly name: string
  readonly email: string | null
  readonly role: "participant" | "coach" | "admin" | "stakeholder"
  readonly roleLabel: string
  readonly status: "active" | "paused" | "ended"
  readonly statusLabel: string
  readonly joinedAtLabel: string
  readonly completionPercent: number
  readonly progressLabel: string
  readonly shareLabel: string
  readonly shareTone: "success" | "warning" | "neutral"
}

export type AdminMembersViewModel = {
  readonly programName: string
  readonly dateRangeLabel: string
  readonly summary: {
    readonly totalMembers: number
    readonly activeParticipants: number
    readonly activeCoaches: number
    readonly consentedCount: number
  }
  readonly members: readonly AdminMemberRosterRow[]
}

export type AdminSessionRow = {
  readonly id: string
  readonly sessionNumber: number
  readonly kindLabel: string
  readonly title: string
  readonly scheduledAtLabel: string
}

export type AdminScheduleViewModel = {
  readonly programName: string
  readonly dateRangeLabel: string
  readonly timeTrialLabel: string
  readonly summary: {
    readonly totalSessions: number
    readonly upcomingCount: number
    readonly pastCount: number
  }
  readonly sessions: readonly AdminSessionRow[]
}

export type AdminSettingsRow = {
  readonly id: string
  readonly displayName: string
  readonly statusLabel: string
  readonly statusTone: "critical" | "warning" | "neutral"
  readonly requestedAtLabel: string
}

export type AdminFailedNotificationRow = {
  readonly id: string
  readonly title: string
  readonly channelLabel: string
  readonly statusLabel: string
  readonly statusTone: "critical" | "warning"
  readonly attemptCount: number
  readonly errorCodeLabel: string
  readonly createdAtLabel: string
}

export type AdminSettingsViewModel = {
  readonly programName: string
  readonly dateRangeLabel: string
  readonly timeTrialLabel: string
  readonly statusLabel: string
  readonly summary: {
    readonly deletionRequestCount: number
    readonly failedNotificationCount: number
  }
  readonly deletionRequests: readonly AdminSettingsRow[]
  readonly failedNotifications: readonly AdminFailedNotificationRow[]
}
