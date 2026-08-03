import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

export type AiConsentPurpose = "screenshot_ai" | "generative_feedback_ai"

export type AiConsentSpec = {
  readonly programId: string
  readonly participantId: string
  readonly purpose: AiConsentPurpose
  readonly projectId: string
}

export type AiConsentReader = (spec: AiConsentSpec) => Promise<unknown>

const expectedDataClasses: Readonly<Record<AiConsentPurpose, readonly string[]>> = {
  screenshot_ai: ["server_sanitized_screenshot_pixels", "reviewable_metric_draft"],
  generative_feedback_ai: ["approved_nonsensitive_training_context", "feedback_draft"],
}
const OPENAI_PROJECT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/

const consentGrantSchema = z.object({
  program_id: z.string().uuid(),
  participant_profile_id: z.string().uuid(),
  purpose: z.enum(["screenshot_ai", "generative_feedback_ai"]),
  provider: z.string(),
  provider_project_id: z.string().nullable(),
  endpoint: z.string(),
  data_classes: z.array(z.string()),
  processor_disclosure: z.string().nullable(),
  zero_data_retention_control: z.string().nullable(),
  status: z.string(),
  granted_at: z.string().datetime({ offset: true }),
  expires_at: z.string().datetime({ offset: true }),
  withdrawn_at: z.string().datetime({ offset: true }).nullable(),
})

export class AiConsentError extends Error {
  readonly name = "AiConsentError"
  readonly status = 403
  readonly code = "ai_consent_required"

  constructor() {
    super("ai_consent_required")
  }
}

export function parseOpenAiProjectId(value: string | undefined): string | null {
  const projectId = value?.trim()
  return projectId && OPENAI_PROJECT_PATTERN.test(projectId) ? projectId : null
}

function hasExactDataClasses(actual: readonly string[], expected: readonly string[]): boolean {
  return (
    actual.length === expected.length && actual.every((value, index) => value === expected[index])
  )
}

function assertConsentRow(value: unknown, spec: AiConsentSpec, now: Date): void {
  const parsed = consentGrantSchema.safeParse(value)
  if (!parsed.success) throw new AiConsentError()
  const grant = parsed.data
  if (
    grant.program_id !== spec.programId ||
    grant.participant_profile_id !== spec.participantId ||
    grant.purpose !== spec.purpose ||
    grant.provider !== "openai" ||
    grant.provider_project_id !== spec.projectId ||
    grant.endpoint !== "/v1/responses" ||
    !hasExactDataClasses(grant.data_classes, expectedDataClasses[spec.purpose]) ||
    grant.processor_disclosure !== "openai_subprocessor_disclosed" ||
    grant.zero_data_retention_control !== "approved_project_endpoint_zdr" ||
    grant.status !== "active" ||
    grant.withdrawn_at !== null ||
    Date.parse(grant.granted_at) > now.getTime() ||
    Date.parse(grant.expires_at) <= now.getTime()
  ) {
    throw new AiConsentError()
  }
}

async function readActiveConsent(client: SupabaseClient, spec: AiConsentSpec): Promise<unknown> {
  const { data, error } = await client
    .from("consent_grants")
    .select(
      "program_id,participant_profile_id,purpose,provider,provider_project_id,endpoint,data_classes,processor_disclosure,zero_data_retention_control,status,granted_at,expires_at,withdrawn_at",
    )
    .eq("program_id", spec.programId)
    .eq("participant_profile_id", spec.participantId)
    .eq("purpose", spec.purpose)
    .eq("status", "active")
    .maybeSingle()
  if (error) throw new AiConsentError()
  return data
}

export async function runAfterActiveAiConsent<T>(
  reader: AiConsentReader,
  spec: AiConsentSpec,
  action: () => Promise<T>,
  now = new Date(),
): Promise<T> {
  assertConsentRow(await reader(spec), spec, now)
  return action()
}

export async function assertActiveAiConsent(
  client: SupabaseClient,
  spec: AiConsentSpec,
): Promise<void> {
  assertConsentRow(await readActiveConsent(client, spec), spec, new Date())
}

export function withActiveAiConsent<T>(
  client: SupabaseClient,
  spec: AiConsentSpec,
  action: () => Promise<T>,
): Promise<T> {
  return runAfterActiveAiConsent((scope) => readActiveConsent(client, scope), spec, action)
}
