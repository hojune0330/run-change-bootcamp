import { z } from "zod"
import {
  type AuditEvent,
  AuditEventSchema,
  buildNineWeekSchedule,
  type ConsentGrant,
  ConsentGrantSchema,
  ConsentItemSchema,
  type ConsentRevocation,
  ConsentRevocationSchema,
  type ImportArtifact,
  type MembershipId,
  MembershipIdSchema,
  type MetricDraft,
  type ParticipantMembership,
  type ProgramInstance,
  ProgramInstanceSchema,
  type ScheduledSession,
  TimeTrialDecisionSchema,
} from "../domain"
import type { BootcampSeed } from "./seed"

export type StoreImportResult =
  | { readonly kind: "stored"; readonly artifact: ImportArtifact; readonly draftCount: number }
  | { readonly kind: "duplicate"; readonly existing: ImportArtifact }
  | {
      readonly kind: "rejected"
      readonly reason: "draft_artifact_mismatch" | "empty_drafts"
    }

export type RevokeConsentResult =
  | { readonly kind: "revoked"; readonly revocation: ConsentRevocation }
  | {
      readonly kind: "rejected"
      readonly reason: "grant_not_found" | "participant_mismatch" | "already_revoked"
    }

export const SharingQuerySchema = z
  .object({
    participantId: MembershipIdSchema,
    audience: z.enum(["coach", "stakeholder", "peers"]),
    item: ConsentItemSchema,
  })
  .strict()
  .readonly()
export type SharingQuery = z.infer<typeof SharingQuerySchema>

export interface BootcampRepository {
  getProgram(): ProgramInstance
  listParticipants(): readonly ParticipantMembership[]
  getSchedule(): readonly ScheduledSession[]
  decideTimeTrial(input: unknown): ProgramInstance
  storeImport(artifact: ImportArtifact, drafts: readonly MetricDraft[]): StoreImportResult
  listMetricDrafts(participantId: MembershipId): readonly MetricDraft[]
  grantConsent(input: unknown): ConsentGrant
  revokeConsent(input: unknown): RevokeConsentResult
  canShare(input: unknown): boolean
  listAuditEvents(): readonly AuditEvent[]
}

export class InMemoryBootcampRepository implements BootcampRepository {
  private program: ProgramInstance
  private readonly participants: readonly ParticipantMembership[]
  private readonly imports: ImportArtifact[] = []
  private readonly drafts: MetricDraft[] = []
  private readonly grants: ConsentGrant[] = []
  private readonly revocations: ConsentRevocation[] = []
  private readonly auditEvents: AuditEvent[] = []
  private auditSequence = 0

  constructor(seed: BootcampSeed) {
    this.program = seed.program
    this.participants = [...seed.participants]
  }

  getProgram(): ProgramInstance {
    return this.program
  }

  listParticipants(): readonly ParticipantMembership[] {
    return [...this.participants]
  }

  getSchedule(): readonly ScheduledSession[] {
    return buildNineWeekSchedule({
      startsOn: this.program.startsOn,
      decision: this.program.timeTrial,
    })
  }

  decideTimeTrial(input: unknown): ProgramInstance {
    const decision = TimeTrialDecisionSchema.parse(input)
    this.program = ProgramInstanceSchema.parse({ ...this.program, timeTrial: decision })
    this.auditEvents.push(
      AuditEventSchema.parse({
        id: this.nextAuditId(),
        kind: "time_trial_decided",
        actorId: decision.decidedBy,
        occurredAt: decision.decidedAt,
        programId: this.program.id,
        session: decision.session,
        protocol: decision.protocol,
      }),
    )
    return this.program
  }

  storeImport(artifact: ImportArtifact, drafts: readonly MetricDraft[]): StoreImportResult {
    if (drafts.length === 0) {
      return { kind: "rejected", reason: "empty_drafts" }
    }
    const existing = this.imports.find(
      (candidate) =>
        candidate.participantId === artifact.participantId &&
        candidate.checksum === artifact.checksum,
    )
    if (existing !== undefined) {
      return { kind: "duplicate", existing }
    }
    const matches = drafts.every(
      (draft) => draft.artifactId === artifact.id && draft.participantId === artifact.participantId,
    )
    if (!matches) {
      return { kind: "rejected", reason: "draft_artifact_mismatch" }
    }
    this.imports.push(artifact)
    this.drafts.push(...drafts)
    this.auditEvents.push(
      AuditEventSchema.parse({
        id: this.nextAuditId(),
        kind: "import_received",
        actorId: artifact.participantId,
        occurredAt: artifact.importedAt,
        artifactId: artifact.id,
      }),
    )
    return { kind: "stored", artifact, draftCount: drafts.length }
  }

  listMetricDrafts(participantId: MembershipId): readonly MetricDraft[] {
    return this.drafts.filter((draft) => draft.participantId === participantId)
  }

  grantConsent(input: unknown): ConsentGrant {
    const grant = ConsentGrantSchema.parse(input)
    this.grants.push(grant)
    this.auditEvents.push(
      AuditEventSchema.parse({
        id: this.nextAuditId(),
        kind: "consent_granted",
        actorId: grant.participantId,
        occurredAt: grant.grantedAt,
        grantId: grant.id,
      }),
    )
    return grant
  }

  revokeConsent(input: unknown): RevokeConsentResult {
    const revocation = ConsentRevocationSchema.parse(input)
    const grant = this.grants.find((candidate) => candidate.id === revocation.grantId)
    if (grant === undefined) {
      return { kind: "rejected", reason: "grant_not_found" }
    }
    if (grant.participantId !== revocation.participantId) {
      return { kind: "rejected", reason: "participant_mismatch" }
    }
    if (this.revocations.some((candidate) => candidate.grantId === revocation.grantId)) {
      return { kind: "rejected", reason: "already_revoked" }
    }
    this.revocations.push(revocation)
    this.auditEvents.push(
      AuditEventSchema.parse({
        id: this.nextAuditId(),
        kind: "consent_revoked",
        actorId: revocation.participantId,
        occurredAt: revocation.revokedAt,
        revocationId: revocation.id,
        grantId: revocation.grantId,
      }),
    )
    return { kind: "revoked", revocation }
  }

  canShare(input: unknown): boolean {
    const query = SharingQuerySchema.parse(input)
    return this.grants.some(
      (grant) =>
        grant.participantId === query.participantId &&
        grant.audience === query.audience &&
        grant.item.kind === query.item.kind &&
        grant.item.id === query.item.id &&
        !this.revocations.some((revocation) => revocation.grantId === grant.id),
    )
  }

  listAuditEvents(): readonly AuditEvent[] {
    return [...this.auditEvents]
  }

  private nextAuditId(): string {
    this.auditSequence += 1
    return `audit-event-${this.auditSequence}`
  }
}
