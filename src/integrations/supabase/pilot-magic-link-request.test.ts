import { once } from "node:events"
import { readFileSync } from "node:fs"
import { createServer } from "node:http"
import { resolve } from "node:path"
import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import {
  type PilotMagicLinkRequestDiagnostic,
  processPilotMagicLinkRequest,
  requestPilotOtp,
} from "../../../supabase/functions/_shared/pilot-magic-link-request.ts"

const VALID_INPUT = {
  callbackUrl: "https://pilot.example.com/auth/callback",
  codeChallenge: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ",
  codeChallengeMethod: "s256",
  email: "runner@example.com",
} as const

const OtpBodySchema = z
  .object({
    code_challenge: z.string().min(43),
    code_challenge_method: z.literal("s256"),
    create_user: z.literal(false),
    email: z.email(),
  })
  .strict()
  .readonly()

type ProxyRun = {
  readonly attempts: number
  readonly diagnostics: readonly PilotMagicLinkRequestDiagnostic[]
  readonly response: Readonly<Record<string, never>>
}

async function runProxy(outcome: "known" | "retry" | "unknown"): Promise<ProxyRun> {
  const diagnostics: PilotMagicLinkRequestDiagnostic[] = []
  const tasks: Promise<void>[] = []
  let attempts = 0
  const response = processPilotMagicLinkRequest(VALID_INPUT, {
    defer: (task) => tasks.push(task),
    redirectAllowed: () => true,
    report: (diagnostic) => diagnostics.push(diagnostic),
    requestOtp: async () => {
      attempts += 1
      if (outcome !== "known") throw new Error(`internal_${outcome}`)
    },
  })
  await Promise.all(tasks)
  return { attempts, diagnostics, response }
}

describe("uniform pilot magic-link request proxy", () => {
  it("returns the same response for known, unknown, and retry outcomes", async () => {
    // Given
    // When
    const results = await Promise.all([runProxy("known"), runProxy("unknown"), runProxy("retry")])

    // Then
    expect(results.map((result) => result.response)).toEqual([{}, {}, {}])
    expect(results.map((result) => result.attempts)).toEqual([1, 1, 1])
    expect(results.map((result) => result.diagnostics)).toEqual([
      [],
      ["otp_request_failed"],
      ["otp_request_failed"],
    ])
  })

  it("normalizes the email before the deferred internal OTP request", async () => {
    // Given
    const tasks: Promise<void>[] = []
    const requestOtp = vi.fn(async () => undefined)

    // When
    const response = processPilotMagicLinkRequest(
      { ...VALID_INPUT, email: " Runner@Example.COM " },
      {
        defer: (task) => tasks.push(task),
        redirectAllowed: () => true,
        report: () => undefined,
        requestOtp,
      },
    )
    await Promise.all(tasks)

    // Then
    expect(response).toEqual({})
    expect(requestOtp).toHaveBeenCalledWith({
      callbackUrl: VALID_INPUT.callbackUrl,
      codeChallenge: VALID_INPUT.codeChallenge,
      codeChallengeMethod: VALID_INPUT.codeChallengeMethod,
      email: VALID_INPUT.email,
    })
  })

  it.each([
    ["malformed", { ...VALID_INPUT, email: "not-an-email" }],
    ["redirect", { ...VALID_INPUT, callbackUrl: "https://evil.example/auth/callback" }],
  ] as const)("fails closed for an invalid %s without an OTP request", async (_case, input) => {
    // Given
    const diagnostics: PilotMagicLinkRequestDiagnostic[] = []
    const tasks: Promise<void>[] = []
    const requestOtp = vi.fn(async () => undefined)

    // When
    const response = processPilotMagicLinkRequest(input, {
      defer: (task) => tasks.push(task),
      redirectAllowed: (callbackUrl) => callbackUrl === VALID_INPUT.callbackUrl,
      report: (diagnostic) => diagnostics.push(diagnostic),
      requestOtp,
    })
    await Promise.all(tasks)

    // Then
    expect(response).toEqual({})
    expect(requestOtp).not.toHaveBeenCalled()
    expect(diagnostics).toEqual([_case === "malformed" ? "invalid_request" : "invalid_redirect"])
  })

  it("keeps real internal HTTP outcomes behind one accepted response", async () => {
    // Given
    const bodies: unknown[] = []
    const redirects: string[] = []
    const apiKeys: Array<string | undefined> = []
    let hookCount = 0
    const server = createServer(async (request, response) => {
      const chunks: Uint8Array[] = []
      for await (const chunk of request) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
      }
      const parsed = OtpBodySchema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")))
      if (!parsed.success) {
        response.writeHead(400).end("{}")
        return
      }
      const url = new URL(request.url ?? "/", "http://127.0.0.1")
      bodies.push(parsed.data)
      redirects.push(url.searchParams.get("redirect_to") ?? "")
      const apiKey = request.headers["apikey"]
      apiKeys.push(Array.isArray(apiKey) ? apiKey.join(",") : apiKey)
      if (parsed.data.email === "known@example.com") {
        hookCount += 1
        response.writeHead(200, { "content-type": "application/json" }).end("{}")
        return
      }
      if (parsed.data.email === "unknown@example.com") {
        response
          .writeHead(422, { "content-type": "application/json" })
          .end('{"code":"otp_disabled"}')
        return
      }
      response
        .writeHead(429, { "content-type": "application/json" })
        .end('{"code":"over_email_send_rate_limit"}')
    })
    server.listen(0, "127.0.0.1")
    await once(server, "listening")
    const address = server.address()
    if (address === null || typeof address === "string") {
      throw new Error("HTTP mock did not expose a TCP port")
    }
    const diagnostics: PilotMagicLinkRequestDiagnostic[][] = []
    const responses: Readonly<Record<string, never>>[] = []
    const tasks: Promise<void>[] = []

    try {
      // When
      for (const email of ["known@example.com", "unknown@example.com", "retry@example.com"]) {
        const runDiagnostics: PilotMagicLinkRequestDiagnostic[] = []
        diagnostics.push(runDiagnostics)
        responses.push(
          processPilotMagicLinkRequest(
            { ...VALID_INPUT, email },
            {
              defer: (task) => tasks.push(task),
              redirectAllowed: () => true,
              report: (diagnostic) => runDiagnostics.push(diagnostic),
              requestOtp: (input) =>
                requestPilotOtp(input, {
                  authUrl: `http://127.0.0.1:${address.port}`,
                  fetcher: globalThis.fetch,
                  publicKey: "public-boundary-key",
                }),
            },
          ),
        )
      }
      await Promise.all(tasks)

      // Then
      expect(responses).toEqual([{}, {}, {}])
      expect(bodies).toEqual([
        {
          code_challenge: VALID_INPUT.codeChallenge,
          code_challenge_method: "s256",
          create_user: false,
          email: "known@example.com",
        },
        {
          code_challenge: VALID_INPUT.codeChallenge,
          code_challenge_method: "s256",
          create_user: false,
          email: "unknown@example.com",
        },
        {
          code_challenge: VALID_INPUT.codeChallenge,
          code_challenge_method: "s256",
          create_user: false,
          email: "retry@example.com",
        },
      ])
      expect(redirects).toEqual([
        VALID_INPUT.callbackUrl,
        VALID_INPUT.callbackUrl,
        VALID_INPUT.callbackUrl,
      ])
      expect(apiKeys).toEqual(["public-boundary-key", "public-boundary-key", "public-boundary-key"])
      expect(hookCount).toBe(1)
      expect(diagnostics).toEqual([[], ["otp_request_failed"], ["otp_request_failed"]])
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error === undefined ? resolve() : reject(error)))
      })
    }
  })

  it("wires the public Edge boundary without bypassing the signed email hook", () => {
    // Given
    const source = readFileSync(
      resolve(process.cwd(), "supabase/functions/request-pilot-magic-link/index.ts"),
      "utf8",
    )
    const config = readFileSync(resolve(process.cwd(), "supabase/config.toml"), "utf8")

    // When
    // Then
    expect(source).toContain("processPilotMagicLinkRequest(input")
    expect(source).toContain("EdgeRuntime.waitUntil(task)")
    expect(source).toContain("requestPilotOtp(requestInput")
    expect(source).toContain('Deno.env.get("SUPABASE_ANON_KEY")')
    expect(source).toContain("status: 202")
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY")
    expect(source).not.toContain("admin.generateLink")
    expect(source).not.toMatch(/console\.(?:log|error)\([^\n]*(?:email|token|input)/i)
    expect(config).toMatch(/\[functions\.request-pilot-magic-link\]\s+verify_jwt\s*=\s*false/)
  })
})
