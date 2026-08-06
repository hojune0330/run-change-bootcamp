import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEMO_STORAGE_KEY } from "../demo/index.ts"
import { DEFAULT_BRAND } from "../design/brand-config.ts"
import type {
  PilotGateway,
  PilotGatewayFactory,
  PilotSessionState,
} from "../integrations/supabase/pilot-gateway.ts"
import { App } from "./App.tsx"

const VALID_PILOT_ENVIRONMENT = {
  VITE_APP_RUNTIME: "pilot",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_boundary_test_1234567890",
  VITE_SUPABASE_URL: "https://boundary-test.supabase.co",
} as const

const ASSIGNMENT_ID = "99999999-9999-4999-8999-999999999999"
const AUTH_USER_ID = "11111111-1111-4111-8111-111111111111"
const POST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const PROGRAM_ID = "66666666-6666-4666-8666-666666666666"

function createGateway(session: PilotSessionState = { kind: "signed_out" }): PilotGateway {
  return {
    addPostComment: vi.fn<PilotGateway["addPostComment"]>(async () => ({
      ok: true,
      value: { id: POST_ID },
    })),
    changeMetricConsent: vi.fn<PilotGateway["changeMetricConsent"]>(async () => ({
      ok: true,
      value: { auditEventId: 17, auditEventType: "consent.granted", status: "enabled" },
    })),
    completeAssignment: vi.fn<PilotGateway["completeAssignment"]>(async () => ({
      ok: true,
      value: { id: ASSIGNMENT_ID },
    })),
    completeAuthCallback: vi.fn<PilotGateway["completeAuthCallback"]>(async () => ({
      ok: true,
      value: session,
    })),
    decideFeedback: vi.fn<PilotGateway["decideFeedback"]>(async () => ({
      ok: true,
      value: { id: "55555555-5555-4555-8555-555555555555" },
    })),
    getCoachDashboard: vi.fn<PilotGateway["getCoachDashboard"]>(async () => ({
      ok: true,
      value: {
        feedbackQueue: [],
        participants: [],
        program: { endsOn: "2026-10-24", startsOn: "2026-08-24", title: "PLUS Run" },
        summary: {
          missingHomeworkCount: 0,
          painRiskCount: 0,
          pendingFeedbackCount: 0,
          staleDataCount: 0,
          totalParticipants: 0,
        },
        timeTrial: null,
      },
    })),
    getCoachParticipantDetail: vi.fn<PilotGateway["getCoachParticipantDetail"]>(async () => ({
      ok: true,
      value: {
        auditEvents: [],
        consentedMetricTypes: [],
        healthMetricTypes: [],
        profile: { displayName: "Runner", email: null, profileId: AUTH_USER_ID },
        sharedMetrics: [],
      },
    })),
    getParticipantChange: vi.fn<PilotGateway["getParticipantChange"]>(async () => ({
      ok: true,
      value: {
        completionPercent: 20,
        consentHistory: [
          {
            auditEventId: 17,
            eventType: "consent.granted",
            occurredAt: "2026-08-25T08:00:00.000Z",
          },
        ],
        feedback: [],
        heartRateConsented: true,
        metrics: [
          {
            count14d: 3,
            metricType: "distance_m",
            observedAt: "2026-08-25T08:00:00.000Z",
            unit: "m",
            value: 5000,
          },
        ],
        profile: { displayName: "Runner", profileId: AUTH_USER_ID },
      },
    })),
    getParticipantFeed: vi.fn<PilotGateway["getParticipantFeed"]>(async () => ({
      ok: true,
      value: { posts: [] },
    })),
    getParticipantToday: vi.fn<PilotGateway["getParticipantToday"]>(async () => ({
      ok: true,
      value: {
        announcement: null,
        assignment: null,
        dateLabel: "8월 31일 월요일",
        profile: { displayName: "Runner", profileId: AUTH_USER_ID },
        program: { title: "PLUS Run" },
      },
    })),
    getSession: vi.fn<PilotGateway["getSession"]>(async () => ({ ok: true, value: session })),
    grantMetricConsent: vi.fn<PilotGateway["grantMetricConsent"]>(async () => ({
      ok: true,
      value: { id: "33333333-3333-4333-8333-333333333333" },
    })),
    listAuditEvents: vi.fn<PilotGateway["listAuditEvents"]>(async () => ({
      ok: true,
      value: [],
    })),
    publishAnnouncement: vi.fn<PilotGateway["publishAnnouncement"]>(async () => ({
      ok: true,
      value: { id: "88888888-8888-4888-8888-888888888888" },
    })),
    publishAssignment: vi.fn<PilotGateway["publishAssignment"]>(async () => ({
      ok: true,
      value: { id: "99999999-9999-4999-8999-999999999999" },
    })),
    requestEmailOtp: vi.fn<PilotGateway["requestEmailOtp"]>(async () => ({
      ok: true,
      value: undefined,
    })),
    saveManualMetric: vi.fn<PilotGateway["saveManualMetric"]>(async () => ({
      ok: true,
      value: { id: "44444444-4444-4444-8444-444444444444" },
    })),
    revokeMetricConsent: vi.fn<PilotGateway["revokeMetricConsent"]>(async () => ({
      ok: true,
      value: { id: "33333333-3333-4333-8333-333333333333" },
    })),
    saveTimeTrial: vi.fn<PilotGateway["saveTimeTrial"]>(async () => ({
      ok: true,
      value: { programId: PROGRAM_ID },
    })),
    setPostHeart: vi.fn<PilotGateway["setPostHeart"]>(async () => ({
      ok: true,
      value: { id: POST_ID },
    })),
    signOut: vi.fn<PilotGateway["signOut"]>(async () => ({ ok: true, value: undefined })),
    subscribeToSession: vi.fn<PilotGateway["subscribeToSession"]>(() => () => undefined),
  }
}

describe("App runtime boundary", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState({}, "", "/")
    vi.restoreAllMocks()
  })

  it("imports a blocked pilot boundary without loading Supabase storage side effects", async () => {
    // Given
    vi.resetModules()
    vi.doMock("../integrations/supabase/browser-client.ts", () => {
      window.localStorage.setItem("supabase-import-probe", "loaded")
      return { createBrowserPilotGateway: vi.fn() }
    })
    const getItem = vi.spyOn(Storage.prototype, "getItem")
    const removeItem = vi.spyOn(Storage.prototype, "removeItem")
    const setItem = vi.spyOn(Storage.prototype, "setItem")

    try {
      // When
      const { App: IsolatedApp } = await import("./App.tsx")
      IsolatedApp({ runtimeEnvironment: { VITE_APP_RUNTIME: "pilot" } })

      // Then
      expect(getItem).not.toHaveBeenCalled()
      expect(removeItem).not.toHaveBeenCalled()
      expect(setItem).not.toHaveBeenCalled()
    } finally {
      vi.doUnmock("../integrations/supabase/browser-client.ts")
    }
  })

  it("keeps the existing chooser and seeded storage when runtime mode is omitted", () => {
    // Given
    const pilotGatewayFactory = vi.fn<PilotGatewayFactory>()

    // When
    render(<App pilotGatewayFactory={pilotGatewayFactory} runtimeEnvironment={{}} />)

    // Then
    expect(screen.getByRole("region", { name: "데모 세션 선택" })).toBeVisible()
    expect(screen.getByRole("button", { name: "참여자로 시작" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "코치로 시작" })).toBeEnabled()
    expect(window.localStorage.getItem(DEMO_STORAGE_KEY)).toMatch(/^\{"version":1,/)
    expect(pilotGatewayFactory).not.toHaveBeenCalled()
  })

  it("blocks pilot mode before touching stale demo storage when public config is missing", () => {
    // Given
    const staleDemoState = JSON.stringify({ participant: "participant-19" })
    window.localStorage.setItem(DEMO_STORAGE_KEY, staleDemoState)
    const getItem = vi.spyOn(Storage.prototype, "getItem")
    const removeItem = vi.spyOn(Storage.prototype, "removeItem")
    const setItem = vi.spyOn(Storage.prototype, "setItem")
    const pilotGatewayFactory = vi.fn<PilotGatewayFactory>()

    // When
    render(
      <App
        pilotGatewayFactory={pilotGatewayFactory}
        runtimeEnvironment={{ VITE_APP_RUNTIME: "pilot" }}
      />,
    )

    // Then
    expect(screen.getByRole("alert")).toBeVisible()
    expect(screen.getByRole("heading", { name: "파일럿 설정이 필요합니다" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "참여자로 시작" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "코치로 시작" })).not.toBeInTheDocument()
    expect(screen.queryByText("participant-19")).not.toBeInTheDocument()
    expect(getItem).not.toHaveBeenCalled()
    expect(removeItem).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
    expect(pilotGatewayFactory).not.toHaveBeenCalled()
    getItem.mockRestore()
    expect(window.localStorage.getItem(DEMO_STORAGE_KEY)).toBe(staleDemoState)
  })

  it("renders the pilot auth shell through the injected factory when public config is valid", async () => {
    // Given
    const gateway = createGateway()
    const pilotGatewayFactory = vi.fn<PilotGatewayFactory>(() => gateway)

    // When
    render(
      <App
        pilotGatewayFactory={pilotGatewayFactory}
        runtimeEnvironment={VALID_PILOT_ENVIRONMENT}
      />,
    )

    // Then
    expect(await screen.findByRole("heading", { name: DEFAULT_BRAND.labels.auth })).toBeVisible()
    expect(screen.getByRole("textbox", { name: "초대 이메일" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "로그인 링크 요청" })).toBeEnabled()
    expect(screen.queryByRole("button", { name: "참여자로 시작" })).not.toBeInTheDocument()
    expect(pilotGatewayFactory).toHaveBeenCalledWith({
      publicKey: VALID_PILOT_ENVIRONMENT.VITE_SUPABASE_PUBLISHABLE_KEY,
      url: VALID_PILOT_ENVIRONMENT.VITE_SUPABASE_URL,
    })
  })

  it("requests an email OTP from the signed-out pilot shell", async () => {
    // Given
    const user = userEvent.setup()
    const gateway = createGateway()

    render(<App pilotGatewayFactory={() => gateway} runtimeEnvironment={VALID_PILOT_ENVIRONMENT} />)
    const email = await screen.findByRole("textbox", { name: "초대 이메일" })

    // When
    await user.type(email, "runner@example.com")
    await user.click(screen.getByRole("button", { name: "로그인 링크 요청" }))

    // Then
    await waitFor(() =>
      expect(gateway.requestEmailOtp).toHaveBeenCalledWith({
        callbackUrl: `${window.location.origin}/auth/callback`,
        email: "runner@example.com",
      }),
    )
    expect(screen.getByRole("status")).toBeVisible()
  })

  it("keeps a callback error visible instead of replacing it with initial signed-out state", async () => {
    // Given
    window.history.replaceState({}, "", "/auth/callback?error_code=otp_expired")
    const gateway = createGateway()
    gateway.completeAuthCallback = vi.fn<PilotGateway["completeAuthCallback"]>(async () => ({
      error: { kind: "expired_link", retryable: false },
      ok: false,
    }))

    // When
    render(<App pilotGatewayFactory={() => gateway} runtimeEnvironment={VALID_PILOT_ENVIRONMENT} />)

    // Then
    expect(await screen.findByRole("alert")).toHaveTextContent("15분 유효 시간이 지났습니다")
    expect(gateway.subscribeToSession).not.toHaveBeenCalled()
  })

  it("shows a signed-in identity and signs out without exposing demo choices", async () => {
    // Given
    const user = userEvent.setup()
    const gateway = createGateway({
      kind: "active",
      membership: {
        email: "coach@example.com",
        membershipId: "77777777-7777-4777-8777-777777777777",
        programId: "66666666-6666-4666-8666-666666666666",
        role: "coach",
        route: "/coach/cohort",
        userId: "11111111-1111-4111-8111-111111111111",
      },
    })
    render(<App pilotGatewayFactory={() => gateway} runtimeEnvironment={VALID_PILOT_ENVIRONMENT} />)
    const signOut = await screen.findByRole("button", { name: "로그아웃" })
    expect(screen.getByText("coach@example.com")).toBeVisible()

    // When
    await user.click(signOut)

    // Then
    expect(gateway.signOut).toHaveBeenCalledOnce()
    expect(await screen.findByRole("textbox", { name: "초대 이메일" })).toBeEnabled()
    expect(screen.queryByRole("button", { name: "코치로 시작" })).not.toBeInTheDocument()
  })
})
