import { type FormEvent, useEffect, useState } from "react"
import { Badge, Button, Card } from "../../components/primitives/index.ts"
import type {
  PilotGateway,
  PilotOperationError,
  PilotSessionState,
} from "../../integrations/supabase/pilot-gateway.ts"

type AuthViewState = PilotSessionState | { readonly kind: "error" } | { readonly kind: "loading" }

type RequestStatus = "error" | "idle" | "invalid" | "requesting" | "sent"

type PilotAuthShellProps = {
  readonly gateway: PilotGateway
}

function requestErrorStatus(error: PilotOperationError): RequestStatus {
  return error === "invalid_request" ? "invalid" : "error"
}

export function PilotAuthShell({ gateway }: PilotAuthShellProps) {
  const [authState, setAuthState] = useState<AuthViewState>({ kind: "loading" })
  const [email, setEmail] = useState("")
  const [requestStatus, setRequestStatus] = useState<RequestStatus>("idle")
  const [signOutBusy, setSignOutBusy] = useState(false)

  useEffect(() => {
    let active = true
    const unsubscribe = gateway.subscribeToSession((session) => {
      if (active) setAuthState(session)
    })
    void gateway.getSession().then((result) => {
      if (!active) return
      setAuthState(result.ok ? result.value : { kind: "error" })
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [gateway])

  const requestOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRequestStatus("requesting")
    const result = await gateway.requestEmailOtp({ email })
    setRequestStatus(result.ok ? "sent" : requestErrorStatus(result.error))
  }

  const signOut = async () => {
    setSignOutBusy(true)
    const result = await gateway.signOut()
    setSignOutBusy(false)
    if (result.ok) setAuthState({ kind: "signed_out" })
  }

  return (
    <main className="demo-entry" id="main-content">
      <section aria-labelledby="pilot-auth-title" className="demo-entry__panel">
        <header className="demo-entry__header">
          <Badge tone="warning">PILOT AUTH</Badge>
          <p>Supabase 브라우저 경계</p>
          <h1 id="pilot-auth-title">파일럿 로그인</h1>
          <span>인증만 연결된 첫 단계입니다.</span>
        </header>

        <Card eyebrow="AUTH SESSION" title="이메일 OTP">
          {authState.kind === "loading" ? (
            <p aria-live="polite" className="pilot-entry__status">
              로그인 상태를 확인하고 있습니다.
            </p>
          ) : null}
          {authState.kind === "error" ? (
            <p className="pilot-entry__status pilot-entry__status--error" role="alert">
              로그인 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.
            </p>
          ) : null}
          {authState.kind === "signed_out" ? (
            <form className="pilot-entry__form" onSubmit={requestOtp}>
              <label className="demo-entry__field">
                <span>이메일</span>
                <input
                  autoComplete="email"
                  disabled={requestStatus === "requesting"}
                  inputMode="email"
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>
              <Button busy={requestStatus === "requesting"} type="submit">
                이메일 OTP 요청
              </Button>
              {requestStatus === "sent" ? (
                <p className="pilot-entry__status" role="status">
                  등록된 이메일로 OTP 요청을 보냈습니다.
                </p>
              ) : null}
              {requestStatus === "invalid" ? (
                <p className="pilot-entry__status pilot-entry__status--error" role="alert">
                  올바른 이메일 주소를 입력해 주세요.
                </p>
              ) : null}
              {requestStatus === "error" ? (
                <p className="pilot-entry__status pilot-entry__status--error" role="alert">
                  OTP 요청을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.
                </p>
              ) : null}
            </form>
          ) : null}
          {authState.kind === "signed_in" ? (
            <div className="pilot-entry__identity">
              <p>
                <span>로그인됨</span>
                <strong>{authState.user.email ?? authState.user.id}</strong>
              </p>
              <Button busy={signOutBusy} onClick={() => void signOut()} variant="secondary">
                로그아웃
              </Button>
            </div>
          ) : null}
        </Card>

        <Card eyebrow="STAGED CONNECTION" title="운영 데이터 연결 상태" tone="muted">
          <p className="demo-entry__note">
            운영 데이터 연결은 아직 준비 단계입니다. 이 화면은 데모 참여자·코치 데이터를 읽지
            않습니다.
          </p>
        </Card>
      </section>
    </main>
  )
}
