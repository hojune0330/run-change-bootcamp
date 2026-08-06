import { useCallback, useEffect, useState } from "react"
import { Button, Card } from "../../components/primitives/index.ts"
import { type BrandConfig, DEFAULT_BRAND } from "../../design/brand-config.ts"
import { AdminActivityLog, AdminDashboard, AdminMemberRoster } from "../../features/admin/index.ts"
import type {
  PilotAdminActivity,
  PilotAdminMembers,
  PilotAdminOverview,
  PilotGateway,
  PilotMembership,
  PilotOperationError,
} from "../../integrations/supabase/pilot-gateway.ts"
import { AppShell } from "../AppShell.tsx"
import { ADMIN_HREFS, type AdminHref } from "../routes.ts"
import {
  ACTION_OPTIONS,
  adminActivityEntry,
  buildAdminMembersModel,
  buildAdminOverviewModel,
} from "./pilot-admin-models.ts"
import "./pilot-workspace.css"

type PilotAdminWorkspaceProps = {
  readonly brand?: BrandConfig
  readonly gateway: PilotGateway
  readonly membership: PilotMembership
  readonly onSignOut: () => void
  readonly signOutBusy: boolean
}

type LoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "ready" }

function operationMessage(kind: PilotOperationError["kind"]): string {
  switch (kind) {
    case "network":
      return "네트워크에 연결할 수 없습니다. 연결을 확인한 뒤 다시 시도해 주세요."
    case "provider_error":
      return "데이터 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요."
    case "signed_out":
      return "로그인 세션이 종료되었습니다. 새 로그인 링크를 요청해 주세요."
    case "invalid_request":
      return "입력 내용을 확인해 주세요."
    case "invalid_response":
      return "서버 응답을 확인하지 못했습니다. 지원팀에 문의해 주세요."
    default:
      return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."
  }
}

export function PilotAdminWorkspace({
  brand = DEFAULT_BRAND,
  gateway,
  membership,
  onSignOut,
  signOutBusy,
}: PilotAdminWorkspaceProps) {
  const [overview, setOverview] = useState<PilotAdminOverview | null>(null)
  const [activity, setActivity] = useState<readonly PilotAdminActivity[]>([])
  const [members, setMembers] = useState<PilotAdminMembers | null>(null)
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" })
  const [activityState, setActivityState] = useState<LoadState>({ kind: "loading" })
  const [membersState, setMembersState] = useState<LoadState>({ kind: "loading" })
  const [activeHref, setActiveHref] = useState<AdminHref>("/admin/overview")

  const loadOverview = useCallback(async () => {
    const result = await gateway.getAdminOverview(membership.programId)
    if (!result.ok) {
      setLoadState({ kind: "error", message: operationMessage(result.error.kind) })
      return
    }
    setOverview(result.value)
    setLoadState({ kind: "ready" })
  }, [gateway, membership.programId])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  const loadActivity = useCallback(async () => {
    setActivityState({ kind: "loading" })
    const result = await gateway.getAdminActivity(membership.programId)
    if (!result.ok) {
      setActivityState({ kind: "error", message: operationMessage(result.error.kind) })
      return
    }
    setActivity(result.value)
    setActivityState({ kind: "ready" })
  }, [gateway, membership.programId])

  const loadMembers = useCallback(async () => {
    setMembersState({ kind: "loading" })
    const result = await gateway.getAdminMembers(membership.programId)
    if (!result.ok) {
      setMembersState({ kind: "error", message: operationMessage(result.error.kind) })
      return
    }
    setMembers(result.value)
    setMembersState({ kind: "ready" })
  }, [gateway, membership.programId])

  useEffect(() => {
    if (activeHref === "/admin/activity") void loadActivity()
    if (activeHref === "/admin/members") void loadMembers()
  }, [activeHref, loadActivity, loadMembers])

  const handleNavigate = (href: string) => {
    if (href === "/") {
      window.history.replaceState({}, "", "/")
      return
    }
    const adminHref = ADMIN_HREFS.find((candidate) => candidate === href)
    if (adminHref !== undefined) {
      setActiveHref(adminHref)
      window.history.replaceState({}, "", adminHref)
    }
  }

  if (loadState.kind === "loading" && overview === null) {
    return (
      <main className="pilot-workspace" data-runtime-mode="pilot" id="main-content">
        <p aria-live="polite" className="pilot-workspace__status">
          관리자 운영 현황을 불러오고 있습니다.
        </p>
      </main>
    )
  }
  if (loadState.kind === "error" && overview === null) {
    return (
      <main className="pilot-workspace" data-runtime-mode="pilot" id="main-content">
        <p className="pilot-workspace__status pilot-workspace__status--error" role="alert">
          {loadState.message}
        </p>
        <Button onClick={() => void loadOverview()} variant="secondary">
          다시 시도
        </Button>
      </main>
    )
  }

  return (
    <AppShell
      activeHref={activeHref}
      brand={brand}
      mode="admin"
      onNavigate={handleNavigate}
      sessionLabel={`${brand.productName} 운영자`}
    >
      <div className="pilot-workspace">
        <header className="pilot-workspace__session">
          <p>
            <span>{brand.productName} 운영자</span>
            <strong>{membership.email ?? membership.userId}</strong>
          </p>
          <Button busy={signOutBusy} onClick={onSignOut} variant="secondary">
            로그아웃
          </Button>
        </header>
        {activeHref === "/admin/overview" && overview !== null ? (
          <AdminDashboard model={buildAdminOverviewModel(overview)} />
        ) : activeHref === "/admin/activity" ? (
          <Card eyebrow="전체 활동" title="활동 로그">
            {activityState.kind === "error" ? (
              <>
                <p className="pilot-workspace__status pilot-workspace__status--error" role="alert">
                  {activityState.message}
                </p>
                <Button onClick={() => void loadActivity()} variant="secondary">
                  다시 시도
                </Button>
              </>
            ) : activityState.kind === "loading" && activity.length === 0 ? (
              <p aria-live="polite" className="pilot-workspace__status">
                활동 로그를 불러오고 있습니다.
              </p>
            ) : (
              <AdminActivityLog
                actionOptions={ACTION_OPTIONS}
                entries={activity.map(adminActivityEntry)}
              />
            )}
          </Card>
        ) : activeHref === "/admin/members" ? (
          <Card eyebrow="전체 명부" title="멤버 명부">
            {membersState.kind === "error" ? (
              <>
                <p className="pilot-workspace__status pilot-workspace__status--error" role="alert">
                  {membersState.message}
                </p>
                <Button onClick={() => void loadMembers()} variant="secondary">
                  다시 시도
                </Button>
              </>
            ) : membersState.kind === "loading" && members === null ? (
              <p aria-live="polite" className="pilot-workspace__status">
                멤버 명부를 불러오고 있습니다.
              </p>
            ) : members !== null ? (
              <AdminMemberRoster model={buildAdminMembersModel(members)} />
            ) : null}
          </Card>
        ) : (
          <Card eyebrow="파일럿 준비 중" title={`${activeHref} 화면`}>
            <p className="pilot-workspace__status">
              관리자 메뉴는 운영 개요부터 순서대로 파일럿에 연결됩니다. 이 화면은 준비 중입니다.
            </p>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
