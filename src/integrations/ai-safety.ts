export type ProviderEnvironment = {
  readonly apiKey?: string
  readonly model?: string
  readonly safetySalt?: string
}

export type ProviderConfig = {
  readonly apiKey: string
  readonly model: string
  readonly safetySalt: string
}

export type SafetyResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false
      readonly error: "provider_unavailable" | "upload_too_large" | "unsupported_image"
    }

export type ValidatedImage = {
  readonly bytes: Uint8Array
  readonly mimeType: "image/jpeg" | "image/png" | "image/webp"
}

export const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024

export function createProviderConfig(env: ProviderEnvironment): SafetyResult<ProviderConfig> {
  const apiKey = env.apiKey?.trim()
  const model = env.model?.trim()
  const safetySalt = env.safetySalt?.trim()
  if (!apiKey || !model || !safetySalt) {
    return { ok: false, error: "provider_unavailable" }
  }
  return { ok: true, value: { apiKey, model, safetySalt } }
}

export function deidentifyText(value: string): string {
  return value
    .replaceAll(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replaceAll(/(?:\+?82[- .]?)?0?1[016789][- .]?\d{3,4}[- .]?\d{4}/g, "[phone]")
    .replaceAll(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      "[id]",
    )
    .replaceAll(/https?:\/\/\S+/gi, "[url]")
    .replaceAll(/\p{Cc}/gu, " ")
    .slice(0, 4_000)
}

export async function createSafetyIdentifier(userId: string, salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(salt),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(userId)))
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function validateScreenshot(bytes: Uint8Array): SafetyResult<ValidatedImage> {
  if (bytes.byteLength > MAX_SCREENSHOT_BYTES) {
    return { ok: false, error: "upload_too_large" }
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { ok: true, value: { bytes, mimeType: "image/png" } }
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ok: true, value: { bytes, mimeType: "image/jpeg" } }
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { ok: true, value: { bytes, mimeType: "image/webp" } }
  }
  return { ok: false, error: "unsupported_image" }
}
