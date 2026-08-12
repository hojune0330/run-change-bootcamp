import {
  type BrowserContext,
  expect,
  type Page,
  type Route,
  test,
  type WebSocketRoute,
} from "@playwright/test"

const SUPABASE_ORIGIN = "https://boundary-test.supabase.co"
const AUTH_STORAGE_KEY = "run-change:pilot-auth"
const DEMO_STORAGE_KEY = "run-change-bootcamp:demo:v1"
const DEMO_SENTINEL = "PILOT_DEMO_SENTINEL_MUST_NOT_RENDER"
const DEMO_READ_COUNTER_PREFIX = "pilot-demo-storage-reads:"
const USER_ID = "11111111-1111-4111-8111-111111111111"
const MEMBERSHIP_ID = "77777777-7777-4777-8777-777777777777"
const PROGRAM_ID = "66666666-6666-4666-8666-666666666666"

type PilotRole = "admin" | "coach" | "participant" | "stakeholder"
type BoundaryCapture = {
  readonly lifecycleRevisionReads: number[]
  readonly logoutScopes: string[]
  readonly magicLinkBodies: unknown[]
  readonly tokenBodies: unknown[]
  readonly unexpected: string[]
  readonly websocketFrames: string[]
}

const ROLE_ROUTES: Readonly<Record<PilotRole, string>> = {
  admin: "/admin/overview",
  coach: "/coach/cohort",
  participant: "/today",
  stakeholder: "/admin/reports",
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

function sessionResponse(role: PilotRole) {
  const timestamp = new Date().toISOString()
  const user = {
    app_metadata: { provider: "email", providers: ["email"] },
    aud: "authenticated",
    created_at: timestamp,
    email: `${role}@example.com`,
    id: USER_ID,
    identities: [],
    role: "authenticated",
    updated_at: timestamp,
    user_metadata: {},
  }
  return {
    access_token: encodedJwt(),
    expires_in: 3_600,
    refresh_token: `refresh-${role}`,
    token_type: "bearer",
    user,
  }
}

async function installBoundary(context: BrowserContext, role: PilotRole): Promise<BoundaryCapture> {
  const capture: BoundaryCapture = {
    lifecycleRevisionReads: [],
    logoutScopes: [],
    magicLinkBodies: [],
    tokenBodies: [],
    unexpected: [],
    websocketFrames: [],
  }
  await context.routeWebSocket("**/realtime/v1/websocket**", (socket: WebSocketRoute) => {
    socket.onMessage((message) => {
      const serialized = typeof message === "string" ? message : message.toString()
      capture.websocketFrames.push(serialized)
      const frame = JSON.parse(serialized) as readonly [
        joinRef: string | null,
        ref: string | null,
        topic: string,
        event: string,
        payload: unknown,
      ]
      const [joinRef, ref, topic, event] = frame
      if (event !== "phx_join" && event !== "heartbeat" && event !== "phx_leave") {
        return
      }
      socket.send(
        JSON.stringify([joinRef, ref, topic, "phx_reply", { response: {}, status: "ok" }]),
      )
    })
  })
  await context.route(`${SUPABASE_ORIGIN}/**`, async (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    const json = async (body: unknown, status = 200) =>
      route.fulfill({
        body: JSON.stringify(body),
        headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
        status,
      })

    if (request.method() === "POST" && url.pathname === "/functions/v1/request-pilot-magic-link") {
      capture.magicLinkBodies.push(request.postDataJSON())
      await json({}, 202)
      return
    }
    if (
      request.method() === "POST" &&
      url.pathname === "/auth/v1/token" &&
      url.searchParams.get("grant_type") === "pkce"
    ) {
      capture.tokenBodies.push(request.postDataJSON())
      await json(sessionResponse(role))
      return
    }
    if (request.method() === "POST" && url.pathname === "/rest/v1/rpc/bootstrap_pilot_membership") {
      await json({
        membership_id: MEMBERSHIP_ID,
        program_id: PROGRAM_ID,
        role,
        status: "active",
      })
      return
    }
    if (request.method() === "GET" && url.pathname === "/rest/v1/pilot_auth_lifecycle_signals") {
      capture.lifecycleRevisionReads.push(1)
      await json([{ revision: 1 }])
      return
    }
    if (request.method() === "POST" && url.pathname === "/auth/v1/logout") {
      capture.logoutScopes.push(url.searchParams.get("scope") ?? "")
      await route.fulfill({ headers: { "access-control-allow-origin": "*" }, status: 204 })
      return
    }
    capture.unexpected.push(`${request.method()} ${url.pathname}${url.search}`)
    await json({ code: "unexpected_request", message: "Unexpected browser boundary request" }, 500)
  })
  return capture
}

async function requestLink(page: Page, email: string): Promise<void> {
  await page.goto("./")
  await page.getByLabel("초대 이메일").fill(email)
  await page.getByRole("button", { name: "로그인 링크 요청" }).click()
  await expect(page.getByRole("status")).toContainText("15분 동안 유효한 링크")
}

async function storageSnapshot(page: Page): Promise<Readonly<Record<string, string>>> {
  return page.evaluate(() => Object.fromEntries(Object.entries(window.sessionStorage)))
}

async function instrumentDemoStorageSentinel(context: BrowserContext): Promise<void> {
  await context.addInitScript(
    ({ counterPrefix, key, sentinel }) => {
      window.localStorage.setItem(key, sentinel)
      const originalGetItem = Storage.prototype.getItem
      const currentCount = window.name.startsWith(counterPrefix)
        ? Number.parseInt(window.name.slice(counterPrefix.length), 10)
        : 0
      window.name = `${counterPrefix}${Number.isSafeInteger(currentCount) ? currentCount : 0}`
      Storage.prototype.getItem = function (this: Storage, storageKey: string): string | null {
        if (this === window.localStorage && storageKey === key) {
          const count = Number.parseInt(window.name.slice(counterPrefix.length), 10)
          window.name = `${counterPrefix}${count + 1}`
        }
        return originalGetItem.call(this, storageKey)
      }
    },
    { counterPrefix: DEMO_READ_COUNTER_PREFIX, key: DEMO_STORAGE_KEY, sentinel: DEMO_SENTINEL },
  )
}

async function demoStorageReadCount(page: Page): Promise<number> {
  return page.evaluate((counterPrefix) => {
    if (!window.name.startsWith(counterPrefix)) return -1
    return Number.parseInt(window.name.slice(counterPrefix.length), 10)
  }, DEMO_READ_COUNTER_PREFIX)
}

async function phraseLineCount(page: Page, phrase: string): Promise<number> {
  return page.getByRole("alert").evaluate((element, expectedPhrase) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const content = node.textContent ?? ""
      const start = content.indexOf(expectedPhrase)
      if (start === -1) continue
      const range = document.createRange()
      range.setStart(node, start)
      range.setEnd(node, start + expectedPhrase.length)
      return new Set(Array.from(range.getClientRects(), ({ top }) => Math.round(top))).size
    }
    throw new Error(`Visible phrase was not found: ${expectedPhrase}`)
  }, phrase)
}

function requiredEvidenceDir(): string {
  const { PILOT_AUTH_EVIDENCE_DIR: evidenceDir } = process.env
  if (evidenceDir === undefined) throw new Error("PILOT_AUTH_EVIDENCE_DIR is required")
  return evidenceDir
}
const { PILOT_AUTH_E2E } = process.env

test.describe("invite-only pilot auth browser boundary", () => {
  test.skip(PILOT_AUTH_E2E !== "1", "requires the dedicated pilot build")

  test.beforeEach(async ({ page }) => {
    await page.goto("./")
    await expect(
      page.locator('main[data-runtime-mode="pilot"]'),
      "PILOT_BUNDLE_CONFIG_OK",
    ).toBeVisible()
  })

  test("keeps two contexts isolated and completes a real Auth JS PKCE callback", async ({
    browser,
  }, testInfo) => {
    const viewport =
      testInfo.project.name === "mobile-375"
        ? { height: 812, width: 375 }
        : testInfo.project.name === "tablet-768"
          ? { height: 1024, width: 768 }
          : { height: 800, width: 1280 }
    const invitedContext = await browser.newContext({ viewport })
    const unknownContext = await browser.newContext({ viewport })
    await Promise.all([
      instrumentDemoStorageSentinel(invitedContext),
      instrumentDemoStorageSentinel(unknownContext),
    ])
    const invited = await invitedContext.newPage()
    const unknown = await unknownContext.newPage()
    const crossContext = await unknownContext.newPage()
    const invitedCapture = await installBoundary(invitedContext, "participant")
    const unknownCapture = await installBoundary(unknownContext, "participant")

    expect(
      await invited.evaluate(() => ({ height: window.innerHeight, width: window.innerWidth })),
    ).toEqual(viewport)

    await requestLink(invited, " INVITED@example.com ")
    await requestLink(unknown, "unknown@example.com")
    expect(invitedCapture.magicLinkBodies).toEqual([
      expect.objectContaining({
        callbackUrl: "http://127.0.0.1:4186/auth/callback",
        codeChallenge: expect.any(String),
        codeChallengeMethod: "s256",
        email: "invited@example.com",
      }),
    ])
    expect(unknownCapture.magicLinkBodies).toEqual([
      expect.objectContaining({
        callbackUrl: "http://127.0.0.1:4186/auth/callback",
        codeChallenge: expect.any(String),
        codeChallengeMethod: "s256",
        email: "unknown@example.com",
      }),
    ])
    await expect(invited.getByRole("status")).toHaveText(
      await unknown.getByRole("status").innerText(),
    )

    const invitedBefore = await storageSnapshot(invited)
    const unknownBefore = await storageSnapshot(unknown)
    expect(Object.keys(invitedBefore).some((key) => key.endsWith("-code-verifier"))).toBe(true)
    expect(Object.keys(unknownBefore).some((key) => key.endsWith("-code-verifier"))).toBe(true)
    expect(invitedBefore).not.toEqual(unknownBefore)

    await crossContext.goto("/auth/callback?code=single-use")
    await expect(crossContext.getByRole("alert")).toContainText("이미 사용한 로그인 링크입니다")
    expect(invitedCapture.tokenBodies).toEqual([])
    expect(unknownCapture.tokenBodies).toEqual([])

    await invited.goto("/auth/callback?code=single-use")
    await expect
      .poll(() => invitedCapture.websocketFrames.some((frame) => frame.includes('"phx_join"')), {
        message: "REALTIME_JOIN_FRAME_OBSERVED",
      })
      .toBe(true)
    await expect(invited).toHaveURL(/\/today$/)
    await expect(invited.getByText("participant workspace")).toBeVisible()
    expect(invitedCapture.tokenBodies).toEqual([
      expect.objectContaining({ auth_code: "single-use", code_verifier: expect.any(String) }),
    ])
    expect(invitedCapture.lifecycleRevisionReads).toEqual([1])
    expect(invitedCapture.unexpected).toEqual([])
    expect(unknownCapture.unexpected).toEqual([])

    const invitedAfter = await storageSnapshot(invited)
    const unknownAfter = await storageSnapshot(unknown)
    expect(Object.keys(invitedAfter).some((key) => key === AUTH_STORAGE_KEY)).toBe(true)
    expect(Object.keys(invitedAfter).some((key) => key.endsWith("-code-verifier"))).toBe(false)
    expect(Object.keys(unknownAfter).some((key) => key === AUTH_STORAGE_KEY)).toBe(false)
    expect(Object.keys(unknownAfter).some((key) => key.endsWith("-code-verifier"))).toBe(true)
    await expect(unknown.getByLabel("초대 이메일")).toBeVisible()
    await expect(invited.locator("body")).not.toContainText(DEMO_SENTINEL)
    await expect(unknown.locator("body")).not.toContainText(DEMO_SENTINEL)
    await expect(crossContext.locator("body")).not.toContainText(DEMO_SENTINEL)
    expect(await demoStorageReadCount(invited)).toBe(0)
    expect(await demoStorageReadCount(unknown)).toBe(0)
    expect(await demoStorageReadCount(crossContext)).toBe(0)

    const lifecycleReadsBeforeReload = invitedCapture.lifecycleRevisionReads.length
    await invited.reload()
    await expect(invited).toHaveURL(/\/today$/)
    await expect(invited.getByText("participant workspace")).toBeVisible()
    const invitedAfterReload = await storageSnapshot(invited)
    expect(Object.keys(invitedAfterReload).some((key) => key === AUTH_STORAGE_KEY)).toBe(true)
    expect(invitedCapture.lifecycleRevisionReads).toHaveLength(lifecycleReadsBeforeReload + 1)

    const freshTab = await invitedContext.newPage()
    await freshTab.goto("./")
    await expect(freshTab.getByLabel("초대 이메일")).toBeVisible()
    expect(await storageSnapshot(freshTab)).toEqual({})
    await expect(freshTab.locator("body")).not.toContainText(DEMO_SENTINEL)
    expect(await demoStorageReadCount(freshTab)).toBe(0)
    await freshTab.close()

    const overflow = await invited
      .locator("html")
      .evaluate((element) => element.scrollWidth > element.clientWidth)
    expect(overflow).toBe(false)
    await invited.getByRole("button", { name: "로그아웃" }).focus()
    await expect(invited.getByRole("button", { name: "로그아웃" })).toBeFocused()
    await unknown.getByRole("button", { name: "로그인 링크 요청" }).focus()
    await expect(unknown.getByRole("button", { name: "로그인 링크 요청" })).toBeFocused()

    const evidenceDir = requiredEvidenceDir()
    await invited.screenshot({
      fullPage: true,
      path: `${evidenceDir}/active-${testInfo.project.name}.png`,
    })
    await unknown.screenshot({
      fullPage: true,
      path: `${evidenceDir}/signed-out-${testInfo.project.name}.png`,
    })

    await invited.close()
    const reopened = await invitedContext.newPage()
    await reopened.goto("./")
    await expect(reopened.getByLabel("초대 이메일")).toBeVisible()
    expect(await storageSnapshot(reopened)).toEqual({})
    await expect(reopened.locator("body")).not.toContainText(DEMO_SENTINEL)
    expect(await demoStorageReadCount(reopened)).toBe(0)
    expect(invitedCapture.logoutScopes).toEqual([])
    await invitedContext.close()
    await unknownContext.close()
  })

  test("routes every server-owned pilot role atomically", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1280", "desktop role matrix")
    for (const role of Object.keys(ROLE_ROUTES) as PilotRole[]) {
      const context = await browser.newContext()
      const capture = await installBoundary(context, role)
      const page = await context.newPage()
      await requestLink(page, `${role}@example.com`)
      expect(capture.magicLinkBodies).toEqual([
        expect.objectContaining({
          callbackUrl: "http://127.0.0.1:4186/auth/callback",
          codeChallenge: expect.any(String),
          codeChallengeMethod: "s256",
        }),
      ])
      await page.goto(`/auth/callback?code=${role}`)
      await expect
        .poll(() => capture.websocketFrames.some((frame) => frame.includes('"phx_join"')), {
          message: `REALTIME_JOIN_FRAME_OBSERVED:${role}`,
        })
        .toBe(true)
      await expect(page).toHaveURL(new RegExp(`${ROLE_ROUTES[role]}$`))
      await expect(page.getByText(`${role} workspace`)).toBeVisible()
      expect(capture.lifecycleRevisionReads).toEqual([1])
      if (role === "participant") {
        await page.getByRole("button", { name: "로그아웃" }).click()
        await expect(page.getByLabel("초대 이메일")).toBeVisible()
        expect(await storageSnapshot(page)).toEqual({})
        expect(capture.logoutScopes).toEqual(["local"])
      }
      expect(capture.unexpected).toEqual([])
      await context.close()
    }
  })

  test("shows a network recovery state when the magic-link proxy is unreachable", async ({
    context,
    page,
  }, testInfo) => {
    // Given
    await installBoundary(context, "participant")
    await context.route(`${SUPABASE_ORIGIN}/functions/v1/request-pilot-magic-link`, async (route) =>
      route.abort("connectionfailed"),
    )

    // When
    await page.goto("./")
    await page.getByLabel("초대 이메일").fill("invited@example.com")
    await page.getByRole("button", { name: "로그인 링크 요청" }).click()

    // Then
    await expect(page.getByRole("alert")).toContainText("네트워크에 연결할 수 없습니다")
    if (testInfo.project.name === "mobile-375") {
      expect(await phraseLineCount(page, "확인한\u00a0뒤")).toBe(1)
    }
    await expect(page.getByRole("button", { name: "로그인 링크 요청" })).toBeEnabled()
    const evidenceDir = requiredEvidenceDir()
    await page.screenshot({
      fullPage: true,
      path: `${evidenceDir}/network-request-${testInfo.project.name}.png`,
    })
  })

  test("shows a network recovery state when callback exchange is unreachable", async ({
    context,
    page,
  }, testInfo) => {
    // Given
    await installBoundary(context, "participant")
    await requestLink(page, "invited@example.com")
    await context.route(`${SUPABASE_ORIGIN}/auth/v1/token**`, async (route) =>
      route.abort("connectionfailed"),
    )

    // When
    await page.goto("/auth/callback?code=single-use")

    // Then
    await expect(page.getByRole("alert")).toContainText("네트워크에 연결할 수 없습니다")
    await expect(page.getByRole("button", { name: "새 로그인 링크 요청" })).toBeEnabled()
    const evidenceDir = requiredEvidenceDir()
    await page.screenshot({
      fullPage: true,
      path: `${evidenceDir}/network-callback-${testInfo.project.name}.png`,
    })
  })

  test("shows an expired-link recovery state on the direct callback route", async ({ page }) => {
    await page.goto("./auth/callback?error_code=otp_expired")
    await expect(page.getByRole("alert")).toContainText("15분 유효 시간이 지났습니다")
    await page.getByRole("button", { name: "새 로그인 링크 요청" }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByLabel("초대 이메일")).toBeVisible()
  })

  test("keeps keyboard focus visible and remains usable at 200 percent zoom", async ({
    context,
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1280", "desktop zoom evidence")
    await installBoundary(context, "participant")
    await page.goto("./")

    const emailInput = page.getByLabel("초대 이메일")
    await expect(emailInput).toBeVisible()
    await emailInput.focus()
    await expect(emailInput).toBeFocused()
    await page.keyboard.press("Tab")
    const requestButton = page.getByRole("button", { name: "로그인 링크 요청" })
    await expect(requestButton).toBeFocused()
    const focusOutline = await requestButton.evaluate((element) => {
      const style = getComputedStyle(element)
      return { style: style.outlineStyle, width: style.outlineWidth }
    })
    expect(focusOutline.style).not.toBe("none")
    expect(focusOutline.width).not.toBe("0px")

    await page.evaluate(() => {
      document.documentElement.style.zoom = "2"
    })
    const overflow = await page
      .locator("html")
      .evaluate((element) => element.scrollWidth > element.clientWidth)
    expect(overflow).toBe(false)
    const evidenceDir = requiredEvidenceDir()
    await page.screenshot({ fullPage: true, path: `${evidenceDir}/signed-out-zoom-200.png` })
  })
})
