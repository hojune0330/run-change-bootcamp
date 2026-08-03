import { z } from "zod"

export const RUNTIME_MODES = ["preview", "pilot"] as const
export type RuntimeMode = (typeof RUNTIME_MODES)[number]

export type RuntimeEnvironment = Readonly<Record<string, unknown>>

export type SupabasePublicConfig = {
  readonly publicKey: string
  readonly url: string
}

export type RuntimeConfiguration =
  | { readonly kind: "ready"; readonly mode: "preview" }
  | {
      readonly config: SupabasePublicConfig
      readonly kind: "ready"
      readonly mode: "pilot"
    }
  | {
      readonly kind: "blocked"
      readonly mode: "pilot"
      readonly reason:
        | "ambiguous_public_key"
        | "forbidden_browser_secret"
        | "invalid_public_config"
        | "invalid_runtime"
        | "missing_public_config"
    }

const ALLOWED_BROWSER_ENV_KEYS = [
  "VITE_APP_RUNTIME",
  "VITE_DISABLE_REACT_DEVTOOLS",
  "VITE_PLUS_TENANT",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_URL",
] as const

const LOCAL_SUPABASE_HOSTS = ["127.0.0.1", "[::1]", "localhost"] as const
const PUBLIC_LEGACY_JWT_ROLES = ["anon"] as const
const PUBLIC_PUBLISHABLE_KEY_PREFIX = "sb_publishable_"
const LEGACY_JWT_HEADER_SEGMENT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
const JWT_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseJwtObject(segment: string): Readonly<Record<string, unknown>> | undefined {
  if (!JWT_SEGMENT_PATTERN.test(segment) || segment.length % 4 === 1) return undefined

  try {
    const base64 = segment.replaceAll("-", "+").replaceAll("_", "/")
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=")
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return isRecord(value) ? value : undefined
  } catch {
    return undefined
  }
}

function isSupportedPublicKey(value: string): boolean {
  if (value.startsWith(PUBLIC_PUBLISHABLE_KEY_PREFIX)) return true

  const segments = value.split(".")
  if (
    segments.length !== 3 ||
    segments.some((segment) => segment.length === 0 || !JWT_SEGMENT_PATTERN.test(segment))
  ) {
    return false
  }

  const encodedHeader = segments[0]
  const encodedPayload = segments[1]
  if (encodedHeader === undefined || encodedPayload === undefined) return false

  const header = parseJwtObject(encodedHeader)
  const payload = parseJwtObject(encodedPayload)
  if (
    encodedHeader !== LEGACY_JWT_HEADER_SEGMENT ||
    header?.["alg"] !== "HS256" ||
    header?.["typ"] !== "JWT" ||
    payload === undefined
  ) {
    return false
  }

  return PUBLIC_LEGACY_JWT_ROLES.some((role) => role === payload["role"])
}

const SupabaseUrlSchema = z
  .url()
  .refine((value) => {
    if (!URL.canParse(value)) return false
    const url = new URL(value)
    const hasAllowedProtocol =
      url.protocol === "https:" ||
      (url.protocol === "http:" && LOCAL_SUPABASE_HOSTS.some((host) => host === url.hostname))
    return (
      hasAllowedProtocol &&
      url.username === "" &&
      url.password === "" &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === ""
    )
  })
  .transform((value) => new URL(value).origin)

const SupabasePublicKeySchema = z
  .string()
  .min(20)
  .max(4096)
  .regex(/^[A-Za-z0-9._-]+$/)
  .refine((value) => !value.startsWith("sb_secret_"))
  .refine(isSupportedPublicKey)

function configuredString(environment: RuntimeEnvironment, key: string): string | undefined {
  const value = environment[key]
  return typeof value === "string" && value.length > 0 ? value : undefined
}

export function resolveRuntimeConfiguration(environment: RuntimeEnvironment): RuntimeConfiguration {
  const hasForbiddenSecret = Object.keys(environment).some(
    (key) =>
      key.startsWith("VITE_") &&
      !ALLOWED_BROWSER_ENV_KEYS.some((publicKey) => publicKey === key) &&
      configuredString(environment, key) !== undefined,
  )
  if (hasForbiddenSecret) {
    return { kind: "blocked", mode: "pilot", reason: "forbidden_browser_secret" }
  }

  const runtime = configuredString(environment, "VITE_APP_RUNTIME")
  if (runtime === undefined || runtime === "preview") return { kind: "ready", mode: "preview" }
  if (runtime !== "pilot") return { kind: "blocked", mode: "pilot", reason: "invalid_runtime" }

  const url = configuredString(environment, "VITE_SUPABASE_URL")
  const publishableKey = configuredString(environment, "VITE_SUPABASE_PUBLISHABLE_KEY")
  const anonKey = configuredString(environment, "VITE_SUPABASE_ANON_KEY")
  if (publishableKey !== undefined && anonKey !== undefined) {
    return { kind: "blocked", mode: "pilot", reason: "ambiguous_public_key" }
  }

  const publicKey = publishableKey ?? anonKey
  if (url === undefined || publicKey === undefined) {
    return { kind: "blocked", mode: "pilot", reason: "missing_public_config" }
  }

  const parsedUrl = SupabaseUrlSchema.safeParse(url)
  const parsedKey = SupabasePublicKeySchema.safeParse(publicKey)
  if (!parsedUrl.success || !parsedKey.success) {
    return { kind: "blocked", mode: "pilot", reason: "invalid_public_config" }
  }

  return {
    config: { publicKey: parsedKey.data, url: parsedUrl.data },
    kind: "ready",
    mode: "pilot",
  }
}
