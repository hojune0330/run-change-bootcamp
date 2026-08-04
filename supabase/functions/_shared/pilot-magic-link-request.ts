import { z } from "zod"

const MagicLinkRequestSchema = z
  .object({
    callbackUrl: z.url(),
    codeChallenge: z.string().min(43).max(128),
    codeChallengeMethod: z.literal("s256"),
    email: z.string().trim().toLowerCase().pipe(z.email()),
  })
  .strict()
  .readonly()

export type PilotMagicLinkRequestDiagnostic =
  | "invalid_request"
  | "invalid_redirect"
  | "otp_request_failed"
  | "request_unconfigured"

export type PilotMagicLinkRequest = {
  readonly callbackUrl: string
  readonly codeChallenge: string
  readonly codeChallengeMethod: "s256"
  readonly email: string
}

export type PilotMagicLinkRequestDependencies = {
  readonly defer: (task: Promise<void>) => void
  readonly redirectAllowed: (callbackUrl: string) => boolean
  readonly report: (diagnostic: PilotMagicLinkRequestDiagnostic) => void
  readonly requestOtp: (request: PilotMagicLinkRequest) => Promise<void>
}

export type PilotOtpTransport = {
  readonly authUrl: string
  readonly fetcher: typeof fetch
  readonly publicKey: string
}

export class PilotOtpRequestError extends Error {
  readonly name = "PilotOtpRequestError"

  constructor(readonly status: number) {
    super(`Internal OTP request failed with status ${status}`)
  }
}

export const PILOT_MAGIC_LINK_REQUEST_ACCEPTED = Object.freeze({})

export async function requestPilotOtp(
  request: PilotMagicLinkRequest,
  transport: PilotOtpTransport,
): Promise<void> {
  const url = new URL("/auth/v1/otp", transport.authUrl)
  url.searchParams.set("redirect_to", request.callbackUrl)
  const response = await transport.fetcher(url, {
    body: JSON.stringify({
      code_challenge: request.codeChallenge,
      code_challenge_method: request.codeChallengeMethod,
      create_user: false,
      email: request.email,
    }),
    cache: "no-store",
    headers: {
      apikey: transport.publicKey,
      authorization: `Bearer ${transport.publicKey}`,
      "content-type": "application/json",
    },
    method: "POST",
  })
  if (!response.ok) throw new PilotOtpRequestError(response.status)
}

export function processPilotMagicLinkRequest(
  input: unknown,
  dependencies: PilotMagicLinkRequestDependencies,
): Readonly<Record<string, never>> {
  const request = MagicLinkRequestSchema.safeParse(input)
  if (!request.success) {
    dependencies.report("invalid_request")
    return PILOT_MAGIC_LINK_REQUEST_ACCEPTED
  }
  if (!dependencies.redirectAllowed(request.data.callbackUrl)) {
    dependencies.report("invalid_redirect")
    return PILOT_MAGIC_LINK_REQUEST_ACCEPTED
  }
  dependencies.defer(
    Promise.resolve()
      .then(() => dependencies.requestOtp(request.data))
      .catch(() => dependencies.report("otp_request_failed")),
  )
  return PILOT_MAGIC_LINK_REQUEST_ACCEPTED
}
