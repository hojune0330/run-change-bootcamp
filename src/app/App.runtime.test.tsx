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
            previousObservedAt: null,
            previousValue: null,
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
    getParticipantRecord: vi.fn<PilotGateway["getParticipantRecord"]>(async () => ({
      ok: true,
      value: {
        recordedOn: "2026-08-26",
        supportedExtensions: ["csv", "fit", "gpx", "tcx", "xml", "json"],
      },
    })),
    getParticipantToday: vi.fn<PilotGateway["getParticipantToday"]>(async () => ({
      ok: true,
      value: {
        announcement: null,
        assignment: null,
        backlog: [],
        dateLabel: "8월 31일 월요일",
        profile: { displayName: "Runner", profileId: AUTH_USER_ID },
        program: { title: "PLUS Run" },
        streakDays: 0,
      },
    })),
    getAdminOverview: vi.fn<PilotGateway["getAdminOverview"]>(async () => ({
      ok: true,
      value: {
        activity: [],
        members: [],
        program: {
          endsOn: "2026-10-24",
          startsOn: "2026-08-24",
          status: "active",
          title: "PLUS Run",
        },
        summary: {
          assignmentsCount: 0,
          consentedCount: 0,
          painRiskCount: 0,
          pendingFeedbackCount: 0,
          totalParticipants: 0,
        },
        timeTrial: null,
      },
    })),
    getAdminActivity: vi.fn<PilotGateway["getAdminActivity"]>(async () => ({
      ok: true,
      value: [
        {
          actorRole: "coach",
          auditEventId: 17,
          eventType: "feedback.approved",
          occurredAt: "2026-08-25T09:00:00.000Z",
          summary: "김러너 이지런 피드백 승인",
        },
      ],
    })),
    getAdminMembers: vi.fn<PilotGateway["getAdminMembers"]>(async () => ({
      ok: true,
      value: {
        members: [
          {
            completionPercent: 60,
            displayName: "김러너",
            email: "runner@example.com",
            heartRateShared: true,
            joinedAt: "2026-08-24T09:00:00.000Z",
            membershipId: "77777777-7777-4777-8777-777777777777",
            profileId: AUTH_USER_ID,
            role: "participant",
            status: "active",
          },
        ],
        program: {
          endsOn: "2026-10-24",
          startsOn: "2026-08-24",
          status: "active",
          title: "PLUS Run",
        },
        summary: {
          activeCoaches: 1,
          activeParticipants: 1,
          consentedCount: 1,
          totalMembers: 2,
        },
      },
    })),
    getAdminSchedule: vi.fn<PilotGateway["getAdminSchedule"]>(async () => ({
      ok: true,
      value: {
        program: {
          endsOn: "2026-10-24",
          startsOn: "2026-08-24",
          status: "active",
          title: "PLUS Run",
        },
        sessions: [
          {
            scheduledAt: "2026-08-26T19:00:00.000Z",
            sessionId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            sessionKind: "time_trial",
            sessionNumber: 1,
            title: "기록 측정 1회차",
          },
          {
            scheduledAt: "2026-08-29T19:00:00.000Z",
            sessionId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
            sessionKind: "easy",
            sessionNumber: 2,
            title: "이지런 2회차",
          },
        ],
        summary: {
          pastCount: 1,
          timeTrial: {
            decidedAt: "2026-08-25T09:00:00.000Z",
            initialSessionNumber: 1,
            protocol: "12_minute",
          },
          totalSessions: 2,
          upcomingCount: 1,
        },
      },
    })),
    getAdminSettings: vi.fn<PilotGateway["getAdminSettings"]>(async () => ({
      ok: true,
      value: {
        program: {
          endsOn: "2026-10-24",
          startsOn: "2026-08-24",
          status: "active",
          title: "PLUS Run",
        },
        timeTrial: {
          decidedAt: "2026-08-25T09:00:00.000Z",
          initialSessionNumber: 1,
          protocol: "12_minute",
        },
        summary: {
          deletionRequestCount: 1,
          failedNotificationCount: 1,
        },
        deletionRequests: [
          {
            deletionRequestId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            profileId: AUTH_USER_ID,
            displayName: "김러너",
            status: "requested",
            requestedAt: "2026-08-26T09:00:00.000Z",
          },
        ],
        failedNotifications: [
          {
            outboxId: "12121212-1212-4121-8121-121212121212",
            notificationId: "88888888-8888-4888-8888-888888888888",
            channel: "push",
            title: "일정 변경 안내",
            status: "failed",
            lastErrorCode: "push_provider_error",
            attemptCount: 3,
            createdAt: "2026-08-25T09:30:00.000Z",
          },
        ],
      },
    })),
    getSession: vi.fn<PilotGateway["getSession"]>(async () => ({ ok: true, value: session })),
    importActivityDraft: vi.fn<PilotGateway["importActivityDraft"]>(async () => ({
      ok: true,
      value: { draftCount: 6, uploadId: "abababab-abab-4bab-8bab-abababababab" },
    })),
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
    saveActivityDraft: vi.fn<PilotGateway["saveActivityDraft"]>(async () => ({
      ok: true,
      value: { id: "accepted" },
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

  it("routes an admin session into the admin workspace and renders the overview dashboard", async () => {
    // Given
    const gateway = createGateway({
      kind: "active",
      membership: {
        email: "admin@example.com",
        membershipId: "77777777-7777-4777-8777-777777777777",
        programId: PROGRAM_ID,
        role: "admin",
        route: "/admin/overview",
        userId: AUTH_USER_ID,
      },
    })
    render(<App pilotGatewayFactory={() => gateway} runtimeEnvironment={VALID_PILOT_ENVIRONMENT} />)

    // Then
    expect(await screen.findByRole("heading", { name: "PLUS Run" })).toBeVisible()
    expect(screen.getAllByText("PLUS Run 운영자")).toHaveLength(2)
    expect(screen.getByText("admin@example.com")).toBeVisible()
    expect(screen.getByText("정상 운영")).toBeVisible()
    expect(gateway.getAdminOverview).toHaveBeenCalledWith(PROGRAM_ID)
  })

  it("routes an admin session to the settings and renders snapshot state", async () => {
    // Given
    const user = userEvent.setup()
    const gateway = createGateway({
      kind: "active",
      membership: {
        email: "admin@example.com",
        membershipId: "77777777-7777-4777-8777-777777777777",
        programId: PROGRAM_ID,
        role: "admin",
        route: "/admin/overview",
        userId: AUTH_USER_ID,
      },
    })
    render(<App pilotGatewayFactory={() => gateway} runtimeEnvironment={VALID_PILOT_ENVIRONMENT} />)
    await screen.findByRole("heading", { name: "PLUS Run" })

    // When
    await user.click(screen.getByRole("link", { name: "설정" }))

    // Then
    expect(await screen.findByRole("table", { name: "탈퇴 요청" })).toBeVisible()
    expect(gateway.getAdminSettings).toHaveBeenCalledWith(PROGRAM_ID)
    expect(await screen.findByText("김러너")).toBeVisible()
    expect(screen.getByRole("cell", { name: "요청됨" })).toBeVisible()
    expect(screen.getByRole("table", { name: "미전달 알림" })).toBeVisible()
    expect(screen.getByRole("cell", { name: "푸시" })).toBeVisible()
    expect(screen.getByRole("cell", { name: "실패" })).toBeVisible()
    expect(screen.getByText("3회")).toBeVisible()
    expect(screen.getByText("1회차 · 12분")).toBeVisible()
  })

  it("routes an admin session to the activity log and renders snapshot entries", async () => {
    // Given
    const user = userEvent.setup()
    const gateway = createGateway({
      kind: "active",
      membership: {
        email: "admin@example.com",
        membershipId: "77777777-7777-4777-8777-777777777777",
        programId: PROGRAM_ID,
        role: "admin",
        route: "/admin/overview",
        userId: AUTH_USER_ID,
      },
    })
    render(<App pilotGatewayFactory={() => gateway} runtimeEnvironment={VALID_PILOT_ENVIRONMENT} />)
    await screen.findByRole("heading", { name: "PLUS Run" })

    // When
    await user.click(screen.getByRole("link", { name: "활동 로그" }))

    // Then
    expect(await screen.findByRole("heading", { name: "활동 로그" })).toBeVisible()
    expect(gateway.getAdminActivity).toHaveBeenCalledWith(PROGRAM_ID)
    expect(await screen.findByText("김러너 이지런 피드백 승인")).toBeVisible()
    expect(screen.getByRole("table", { name: "활동 로그" })).toBeVisible()
    expect(screen.getByRole("cell", { name: "코치" })).toBeVisible()
    expect(screen.getByText("1건")).toBeVisible()
  })

  it("routes an admin session to the member roster and renders snapshot rows", async () => {
    // Given
    const user = userEvent.setup()
    const gateway = createGateway({
      kind: "active",
      membership: {
        email: "admin@example.com",
        membershipId: "77777777-7777-4777-8777-777777777777",
        programId: PROGRAM_ID,
        role: "admin",
        route: "/admin/overview",
        userId: AUTH_USER_ID,
      },
    })
    render(<App pilotGatewayFactory={() => gateway} runtimeEnvironment={VALID_PILOT_ENVIRONMENT} />)
    await screen.findByRole("heading", { name: "PLUS Run" })

    // When
    await user.click(screen.getByRole("link", { name: "멤버" }))

    // Then
    expect(await screen.findByRole("heading", { name: "멤버 명부" })).toBeVisible()
    expect(gateway.getAdminMembers).toHaveBeenCalledWith(PROGRAM_ID)
    expect(await screen.findByText("김러너")).toBeVisible()
    expect(screen.getByRole("cell", { name: "runner@example.com" })).toBeVisible()
    expect(screen.getByRole("cell", { name: "참여자" })).toBeVisible()
    expect(screen.getByText("2명")).toBeVisible()
  })

  it("routes an admin session to the schedule and renders snapshot sessions", async () => {
    // Given
    const user = userEvent.setup()
    const gateway = createGateway({
      kind: "active",
      membership: {
        email: "admin@example.com",
        membershipId: "77777777-7777-4777-8777-777777777777",
        programId: PROGRAM_ID,
        role: "admin",
        route: "/admin/overview",
        userId: AUTH_USER_ID,
      },
    })
    render(<App pilotGatewayFactory={() => gateway} runtimeEnvironment={VALID_PILOT_ENVIRONMENT} />)
    await screen.findByRole("heading", { name: "PLUS Run" })

    // When
    await user.click(screen.getByRole("link", { name: "일정" }))

    // Then
    expect(await screen.findByRole("table", { name: "프로그램 일정" })).toBeVisible()
    expect(gateway.getAdminSchedule).toHaveBeenCalledWith(PROGRAM_ID)
    expect(await screen.findByText("기록 측정 1회차")).toBeVisible()
    expect(screen.getByRole("cell", { name: "기록 측정" })).toBeVisible()
    expect(screen.getByText("1회차 · 12분")).toBeVisible()
    expect(screen.getByText("2회")).toBeVisible()
  })

  it("routes a participant session to the record screen and renders the snapshot", async () => {
    // Given
    const user = userEvent.setup()
    const gateway = createGateway({
      kind: "active",
      membership: {
        email: "runner@example.com",
        membershipId: "77777777-7777-4777-8777-777777777777",
        programId: PROGRAM_ID,
        role: "participant",
        route: "/today",
        userId: AUTH_USER_ID,
      },
    })
    render(<App pilotGatewayFactory={() => gateway} runtimeEnvironment={VALID_PILOT_ENVIRONMENT} />)
    await screen.findByRole("heading", { name: "오늘" })

    // When
    await user.click(screen.getByRole("link", { name: "기록" }))

    // Then
    expect(await screen.findByRole("heading", { name: "기록" })).toBeVisible()
    expect(gateway.getParticipantRecord).toHaveBeenCalledWith(PROGRAM_ID)
    expect(screen.getByLabelText("측정일")).toHaveValue("2026-08-26")
    await user.click(screen.getByRole("button", { name: "파일 가져오기" }))
    expect(screen.getByText("지원: CSV, FIT, GPX, TCX, XML, JSON")).toBeVisible()
  })

  it("imports an activity file into a review draft and saves it through the gateway", async () => {
    // Given
    const user = userEvent.setup({ applyAccept: false })
    const gateway = createGateway({
      kind: "active",
      membership: {
        email: "runner@example.com",
        membershipId: "77777777-7777-4777-8777-777777777777",
        programId: PROGRAM_ID,
        role: "participant",
        route: "/today",
        userId: AUTH_USER_ID,
      },
    })
    render(<App pilotGatewayFactory={() => gateway} runtimeEnvironment={VALID_PILOT_ENVIRONMENT} />)
    await screen.findByRole("heading", { name: "오늘" })
    await user.click(screen.getByRole("link", { name: "기록" }))
    await screen.findByRole("heading", { name: "기록" })
    await user.click(screen.getByRole("button", { name: "파일 가져오기" }))

    // When
    const csv =
      "timestamp,metric,value,unit\n2026-08-26T07:00:00+09:00,distance,5230,m\n2026-08-26T07:10:00+09:00,duration,1500,s\n"
    await user.upload(
      screen.getByLabelText("활동 파일"),
      new File([csv], "easy-run.csv", { type: "text/csv" }),
    )
    await user.click(screen.getByRole("button", { name: "초안 만들기" }))

    // Then
    expect(await screen.findByRole("heading", { name: "검토할 기록 초안" })).toBeVisible()
    expect(gateway.importActivityDraft).toHaveBeenCalledWith({
      draftRecords: [
        {
          metricType: "distance_m",
          numericValue: 5230,
          observedAt: "2026-08-26T07:00:00+09:00",
          unit: "m",
        },
        {
          metricType: "duration_s",
          numericValue: 1500,
          observedAt: "2026-08-26T07:10:00+09:00",
          unit: "s",
        },
      ],
      fileName: "easy-run.csv",
      fileSize: expect.any(Number),
      programId: PROGRAM_ID,
      uploadKind: "csv",
    })

    // When
    await user.click(screen.getByRole("button", { name: "검토 완료 · 초안 보관" }))

    // Then
    expect(await screen.findByRole("button", { name: "초안 보관됨" })).toBeDisabled()
    expect(gateway.saveActivityDraft).toHaveBeenCalledWith({
      programId: PROGRAM_ID,
      uploadId: "abababab-abab-4bab-8bab-abababababab",
    })
  })
})
