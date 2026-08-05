import { type FormEvent, useEffect, useState } from "react"
import { BrandLogo } from "../../components/BrandLogo.tsx"
import { Badge, Button, Card } from "../../components/primitives/index.ts"
import { type BrandConfig, DEFAULT_BRAND } from "../../design/brand-config.ts"
import type {
  PilotGateway,
  PilotOperationError,
  PilotSessionState,
} from "../../integrations/supabase/pilot-gateway.ts"
import { PilotCoachWorkspace } from "./PilotCoachWorkspace.tsx"

type AuthViewState =
  | PilotSessionState
  | { readonly error: PilotOperationError; readonly kind: "error" }
  | { readonly kind: "loading" }

type RequestViewState =
  | { readonly kind: "idle" | "requesting" | "sent" }
  | { readonly error: PilotOperationError; readonly kind: "error" }

type PilotAuthShellProps = {
  readonly brand?: BrandConfig
  readonly gateway: PilotGateway
}

function authErrorMessage(error: PilotOperationError): string {
  switch (error.kind) {
    case "expired_link":
      return "로그인 링크의 15분 유효 시간이 지났습니다. 새 링크를 요청해 주세요."
    case "replayed_link":
      return "이미 사용한 로그인 링크입니다. 새 링크를 요청해 주세요."
    case "malformed_callback":
      return "로그인 링크 형식이 올바르지 않습니다. 이메일의 최신 링크를 다시 열어 주세요."
    case "network":
      return "네트워크에 연결할 수 없습니다. 연결을 확인한\u00a0뒤 다시 시도해 주세요."
    case "provider_error":
      return "인증 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요."
    case "invalid_request":
      return "입력한 이메일 주소를 확인해 주세요."
    case "invalid_response":
      return "인증 응답을 확인하지 못했습니다. 지원팀에 문의해 주세요."
    case "resend_guard":
      return `${error.retryAfterSeconds ?? 60}초 뒤에 새 링크를 요청할 수 있습니다.`
    case "aborted":
      return "로그인 요청이 취소되었습니다. 다시 시도해 주세요."
    case "deleted":
      return "삭제된 계정은 파일럿에 로그인할 수 없습니다."
    case "nonmember":
      return "활성 파일럿 초대 또는 멤버십을 찾지 못했습니다."
    case "signed_out":
      return "로그인 세션이 종료되었습니다. 새 링크를 요청해 주세요."
    case "suspended":
      return "일시 중지된 멤버십입니다. 파일럿 관리자에게 문의해 주세요."
    case "withdrawn":
      return "참여 철회가 완료된 계정입니다. 다시 참여하려면 관리자에게 문의해 주세요."
  }
}

function blockedMessage(reason: Extract<PilotSessionState, { kind: "blocked" }>["reason"]): string {
  return authErrorMessage({ kind: reason, retryable: false })
}

function callbackRequest(): boolean {
  return window.location.pathname === "/auth/callback"
}

function callbackUrl(): string {
  return new URL("/auth/callback", window.location.origin).href
}

function routeActiveSession(state: PilotSessionState): void {
  if (state.kind === "active" && window.location.pathname !== state.membership.route) {
    window.history.replaceState({}, "", state.membership.route)
  }
}

export function PilotAuthShell({ brand = DEFAULT_BRAND, gateway }: PilotAuthShellProps) {
  const [authState, setAuthState] = useState<AuthViewState>({ kind: "loading" })
  const [email, setEmail] = useState("")
  const [requestState, setRequestState] = useState<RequestViewState>({ kind: "idle" })
  const [signOutBusy, setSignOutBusy] = useState(false)

  useEffect(() => {
    let active = true
    let revision = 0
    let unsubscribe: () => void = () => undefined
    const subscribe = () => {
      unsubscribe = gateway.subscribeToSession((session) => {
        revision += 1
        routeActiveSession(session)
        if (active) setAuthState(session)
      })
    }
    const settle = async (
      initial: ReturnType<PilotGateway["getSession"]>,
      currentRevision: number,
      subscribeAfterSuccess: boolean,
    ) => {
      const result = await initial
      if (!active || revision !== currentRevision) return
      if (result.ok) routeActiveSession(result.value)
      setAuthState(result.ok ? result.value : { error: result.error, kind: "error" })
      if (result.ok && subscribeAfterSuccess) subscribe()
    }
    if (callbackRequest()) {
      const currentRevision = ++revision
      void settle(
        gateway.completeAuthCallback({ callbackUrl: window.location.href }),
        currentRevision,
        true,
      )
    } else {
      subscribe()
      const currentRevision = ++revision
      void settle(gateway.getSession(), currentRevision, false)
    }
    return () => {
      active = false
      revision += 1
      unsubscribe()
    }
  }, [gateway])

  const requestLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRequestState({ kind: "requesting" })
    const result = await gateway.requestEmailOtp({ callbackUrl: callbackUrl(), email })
    setRequestState(result.ok ? { kind: "sent" } : { error: result.error, kind: "error" })
  }

  const recover = () => {
    window.history.replaceState({}, "", "/")
    setAuthState({ kind: "signed_out" })
    setRequestState({ kind: "idle" })
  }

  const signOut = async () => {
    setSignOutBusy(true)
    const result = await gateway.signOut()
    setSignOutBusy(false)
    setAuthState(result.ok ? { kind: "signed_out" } : { error: result.error, kind: "error" })
  }

  if (authState.kind === "active" && authState.membership.role === "coach") {
    return (
      <PilotCoachWorkspace
        brand={brand}
        gateway={gateway}
        membership={authState.membership}
        onSignOut={() => void signOut()}
        signOutBusy={signOutBusy}
      />
    )
  }

  return (
    <main
      className="demo-entry"
      data-brand-tenant={brand.tenantId}
      data-runtime-mode="pilot"
      id="main-content"
    >
      <section aria-labelledby="pilot-auth-title" className="demo-entry__panel">
        <header className="demo-entry__header">
          <BrandLogo brand={brand} className="demo-entry__brand-logo" />
          <Badge tone="warning">INVITE-ONLY PILOT</Badge>
          <p>{brand.tenantName}</p>
          <h1 aria-label={brand.labels.auth} id="pilot-auth-title">
            {brand.labels.auth.replace("PLUS Run", "PLUS\u00a0Run")}
          </h1>
          <span>사전 초대된 멤버만 이메일 로그인 링크로 입장할&nbsp;수&nbsp;있습니다.</span>
        </header>

        <Card eyebrow="보안 접속" title="이메일 로그인">
          {authState.kind === "loading" ? (
            <p aria-live="polite" className="pilot-entry__status">
              로그인 상태와 파일럿 멤버십을 확인하고 있습니다.
            </p>
          ) : null}
          {authState.kind === "error" ? (
            <div className="pilot-entry__form">
              <p className="pilot-entry__status pilot-entry__status--error" role="alert">
                {authErrorMessage(authState.error)}
              </p>
              <Button onClick={recover} variant="secondary">
                새 로그인 링크 요청
              </Button>
            </div>
          ) : null}
          {authState.kind === "blocked" ? (
            <div className="pilot-entry__form">
              <p className="pilot-entry__status pilot-entry__status--error" role="alert">
                {blockedMessage(authState.reason)}
              </p>
              <Button onClick={recover} variant="secondary">
                다른 초대 이메일 사용
              </Button>
            </div>
          ) : null}
          {authState.kind === "signed_out" ? (
            <form className="pilot-entry__form" onSubmit={requestLink}>
              <label className="demo-entry__field">
                <span>초대 이메일</span>
                <input
                  autoComplete="email"
                  disabled={requestState.kind === "requesting"}
                  inputMode="email"
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>
              <Button busy={requestState.kind === "requesting"} type="submit">
                로그인 링크 요청
              </Button>
              {requestState.kind === "sent" ? (
                <p className="pilot-entry__status" role="status">
                  초대된 주소라면 15분 동안 유효한 링크를 보냅니다. 새 요청은 60초 뒤에 가능합니다.
                </p>
              ) : null}
              {requestState.kind === "error" ? (
                <p className="pilot-entry__status pilot-entry__status--error" role="alert">
                  {authErrorMessage(requestState.error)}
                </p>
              ) : null}
            </form>
          ) : null}
          {authState.kind === "active" ? (
            <div className="pilot-entry__identity">
              <p>
                <span>{authState.membership.role} workspace</span>
                <strong>{authState.membership.email ?? authState.membership.userId}</strong>
              </p>
              <p className="pilot-entry__status" role="status">
                멤버십 확인 완료 · {authState.membership.route}
              </p>
              <Button busy={signOutBusy} onClick={() => void signOut()} variant="secondary">
                로그아웃
              </Button>
            </div>
          ) : null}
        </Card>

        <Card eyebrow="연결 상태" title="운영 데이터 연결 상태" tone="muted">
          <p className="demo-entry__note">
            인증·멤버십 경계만 활성화되어 있습니다. 이&nbsp;화면은 미리보기 데이터 저장소를
            읽지&nbsp;않습니다.
          </p>
        </Card>
      </section>
    </main>
  )
}
