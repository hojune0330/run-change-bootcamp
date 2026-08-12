import { expect, type Page, type Route } from "@playwright/test"

const SUPABASE_ORIGIN = "https://boundary-test.supabase.co"
const USER_ID = "11111111-1111-4111-8111-111111111111"
const PROGRAM_ID = "66666666-6666-4666-8666-666666666666"

export type InsightScenario = "empty" | "ready" | "revoked"

export type BoundaryCapture = {
  readonly activityInsightReads: () => number
  readonly revoke: () => void
  readonly unexpected: readonly string[]
}

function encodedJwt(): string {
  const encode = (value: Readonly<Record<string, unknown>>) =>
    Buffer.from(JSON.stringify(value)).toString("base64url")
  const now = Math.floor(Date.now() / 1_000)
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    aud: "authenticated",
    exp: now + 3_600,
    iat: now,
    role: "authenticated",
    sub: USER_ID,
  })}.dGVzdA`
}

function sessionResponse() {
  const timestamp = new Date().toISOString()
  return {
    access_token: encodedJwt(),
    expires_in: 3_600,
    refresh_token: "refresh-participant",
    token_type: "bearer",
    user: {
      app_metadata: { provider: "email", providers: ["email"] },
      aud: "authenticated",
      created_at: timestamp,
      email: "runner@example.com",
      id: USER_ID,
      identities: [],
      role: "authenticated",
      updated_at: timestamp,
      user_metadata: {},
    },
  }
}

function insightRows() {
  return [
    {
      activity_days: 1,
      activity_insight_sources: [{ count: 99 }],
      average_heart_rate_bpm: 182,
      content_category: "activity_summary",
      content_variant: "one_day",
      delete_after: "2026-11-30T00:00:00.000Z",
      distance_m: 999_000,
      duration_s: 99_999,
      id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
      is_partial_week: false,
      pace_seconds_per_km: 101,
      participant_profile_id: "22222222-2222-4222-8222-222222222222",
      program_id: PROGRAM_ID,
      steps: 99_999,
      template_version: "activity-insight-v1",
      week_end: "2026-09-07",
      week_start: "2026-08-31",
    },
    {
      activity_days: 3,
      activity_insight_sources: [{ count: 3 }],
      average_heart_rate_bpm: 146,
      content_category: "activity_summary",
      content_variant: "multiple_days",
      delete_after: "2026-11-23T00:00:00.000Z",
      distance_m: 12_400,
      duration_s: 4_680,
      id: "bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb",
      is_partial_week: true,
      pace_seconds_per_km: 377,
      participant_profile_id: USER_ID,
      program_id: PROGRAM_ID,
      steps: 18_200,
      template_version: "activity-insight-v1",
      week_end: "2026-08-31",
      week_start: "2026-08-24",
    },
  ]
}

export async function installPilotBoundary(
  page: Page,
  scenario: InsightScenario,
): Promise<BoundaryCapture> {
  const unexpected: string[] = []
  let activityInsightReads = 0
  let revoked = false
  await page.route(`${SUPABASE_ORIGIN}/**`, async (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        body: JSON.stringify(body),
        headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
        status,
      })
    if (
      request.method() === "POST" &&
      url.pathname === "/auth/v1/token" &&
      url.searchParams.get("grant_type") === "pkce"
    ) {
      await json(sessionResponse())
      return
    }
    if (request.method() === "POST" && url.pathname === "/functions/v1/request-pilot-magic-link") {
      await json({}, 202)
      return
    }
    if (request.method() === "POST" && url.pathname === "/rest/v1/rpc/bootstrap_pilot_membership") {
      await json(
        revoked
          ? { status: "withdrawn" }
          : {
              membership_id: "77777777-7777-4777-8777-777777777777",
              program_id: PROGRAM_ID,
              role: "participant",
              status: "active",
            },
      )
      return
    }
    if (request.method() === "GET" && url.pathname === "/rest/v1/pilot_auth_lifecycle_signals") {
      await json([{ revision: 1 }])
      return
    }
    if (request.method() === "POST" && url.pathname === "/rest/v1/rpc/participant_today_snapshot") {
      await json({
        announcement: null,
        assignment: null,
        backlog: [],
        date_label: "8월 26일 수요일",
        profile: { display_name: "러너", profile_id: USER_ID },
        program: { title: "PLUS Run" },
        streak_days: 0,
      })
      return
    }
    if (request.method() === "POST" && url.pathname === "/rest/v1/rpc/participant_feed_snapshot") {
      await json({ posts: [] })
      return
    }
    if (
      request.method() === "POST" &&
      url.pathname === "/rest/v1/rpc/participant_change_snapshot"
    ) {
      await json({
        completion_percent: 0,
        consent_history: [],
        feedback: [],
        heart_rate_consented: false,
        metrics: [],
        profile: { display_name: "러너", profile_id: USER_ID },
      })
      return
    }
    if (
      request.method() === "POST" &&
      url.pathname === "/rest/v1/rpc/participant_record_snapshot"
    ) {
      await json({ recorded_on: "2026-08-26", supported_extensions: ["csv"] })
      return
    }
    if (request.method() === "GET" && url.pathname === "/rest/v1/activity_insights") {
      activityInsightReads += 1
      const requestedParticipant = url.searchParams
        .get("participant_profile_id")
        ?.replace(/^eq\./, "")
      const requestedProgram = url.searchParams.get("program_id")?.replace(/^eq\./, "")
      const rows = insightRows().filter(
        (row) =>
          row.participant_profile_id === requestedParticipant &&
          row.program_id === requestedProgram,
      )
      await json(scenario === "empty" ? [] : rows)
      return
    }
    unexpected.push(`${request.method()} ${url.pathname}${url.search}`)
    await json({ code: "unexpected_request", message: "Unexpected browser request" }, 500)
  })
  await page.routeWebSocket("**/realtime/v1/websocket**", (socket) => {
    socket.onMessage((message) => {
      const frame = JSON.parse(
        typeof message === "string" ? message : message.toString(),
      ) as readonly [string | null, string | null, string, string, unknown]
      socket.send(
        JSON.stringify([frame[0], frame[1], frame[2], "phx_reply", { response: {}, status: "ok" }]),
      )
    })
  })
  return {
    activityInsightReads: () => activityInsightReads,
    revoke: () => {
      revoked = true
    },
    unexpected,
  }
}

export async function authenticateParticipant(page: Page): Promise<void> {
  await page.goto("./")
  await page.getByLabel("초대 이메일").fill("runner@example.com")
  await page.getByRole("button", { name: "로그인 링크 요청" }).click()
  await expect(page.getByRole("status")).toContainText("15분 동안 유효한 링크")
  await page.goto("/auth/callback?code=task8")
  await expect(page).toHaveURL(/\/today$/)
}
