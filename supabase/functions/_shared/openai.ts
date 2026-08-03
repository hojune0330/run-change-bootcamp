import ky from "ky"
import { z } from "zod"
import { createProviderConfig, type ProviderConfig } from "../../../src/integrations/ai-safety.ts"
import { parseOpenAiProjectId } from "./ai-consent.ts"
import { RequestError } from "./http.ts"

type OpenAiProviderConfig = ProviderConfig & { readonly projectId: string }

const envelopeSchema = z.object({ status: z.string(), output: z.array(z.unknown()) })
const messageSchema = z.object({
  type: z.literal("message"),
  content: z.array(
    z.discriminatedUnion("type", [
      z.object({ type: z.literal("output_text"), text: z.string() }),
      z.object({ type: z.literal("refusal"), refusal: z.string() }),
    ]),
  ),
})

export function providerConfig(): OpenAiProviderConfig {
  const result = createProviderConfig({
    apiKey: Deno.env.get("OPENAI_API_KEY"),
    model: Deno.env.get("OPENAI_MODEL"),
    safetySalt: Deno.env.get("OPENAI_SAFETY_SALT"),
  })
  const projectId = parseOpenAiProjectId(Deno.env.get("OPENAI_PROJECT_ID"))
  if (!result.ok || projectId === null) throw new RequestError(503, "provider_unavailable")
  return { ...result.value, projectId }
}

export async function requestStructuredOutput(
  config: OpenAiProviderConfig,
  idempotencyKey: string,
  body: unknown,
): Promise<{ readonly responseId: string | null; readonly value: unknown }> {
  const raw: unknown = await ky
    .post("https://api.openai.com/v1/responses", {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Idempotency-Key": idempotencyKey,
        "OpenAI-Project": config.projectId,
      },
      json: body,
      timeout: 25_000,
      retry: { limit: 2, methods: ["post"], statusCodes: [408, 409, 429, 500, 502, 503, 504] },
    })
    .json()
  const envelope = envelopeSchema.safeParse(raw)
  if (!envelope.success || envelope.data.status !== "completed") {
    throw new RequestError(502, "provider_incomplete")
  }
  for (const output of envelope.data.output) {
    const message = messageSchema.safeParse(output)
    if (!message.success) continue
    for (const content of message.data.content) {
      if (content.type === "refusal") throw new RequestError(422, "provider_refusal")
      const decoded: unknown = JSON.parse(content.text)
      const responseId = z.object({ id: z.string() }).safeParse(raw)
      return { responseId: responseId.success ? responseId.data.id : null, value: decoded }
    }
  }
  throw new RequestError(502, "invalid_provider_response")
}
