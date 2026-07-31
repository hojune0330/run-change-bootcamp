import { describe, expect, it } from "vitest"
import {
  ConsentGrantSchema,
  ConsentRevocationSchema,
  ImportArtifactSchema,
  MetricDraftSchema,
  TimeTrialDecisionSchema,
} from "../domain"
import { InMemoryBootcampRepository } from "./repository"
import { BOOTCAMP_SEED, SEEDED_PARTICIPANTS } from "./seed"

describe("seeded in-memory repository", () => {
  it("seeds one undecided program with exactly twenty ordered participants", () => {
    const repository = new InMemoryBootcampRepository(BOOTCAMP_SEED)

    const participants = repository.listParticipants()

    expect(participants).toHaveLength(20)
    expect(SEEDED_PARTICIPANTS).toHaveLength(20)
    expect(participants.map((participant) => participant.cohortNumber)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    )
    expect(new Set(participants.map((participant) => participant.id)).size).toBe(20)
    expect(repository.getProgram().timeTrial.status).toBe("undecided")
    expect(repository.getSchedule()).toHaveLength(18)
  })

  it("rebuilds the early sessions and week-eight protocol when a decision changes", () => {
    const repository = new InMemoryBootcampRepository(BOOTCAMP_SEED)
    const first = TimeTrialDecisionSchema.parse({
      status: "decided",
      session: 1,
      protocol: "3k",
      decidedAt: "2026-08-20T09:00:00+09:00",
      decidedBy: "membership-coach",
    })
    const changed = TimeTrialDecisionSchema.parse({
      status: "decided",
      session: 2,
      protocol: "5k",
      decidedAt: "2026-08-21T09:00:00+09:00",
      decidedBy: "membership-coach",
    })

    repository.decideTimeTrial(first)
    repository.decideTimeTrial(changed)

    expect(repository.getSchedule()[0]).toMatchObject({ kind: "onboarding_easy" })
    expect(repository.getSchedule()[1]).toMatchObject({
      kind: "initial_time_trial",
      protocol: "5k",
    })
    expect(repository.getSchedule()[15]).toMatchObject({
      kind: "time_trial_retest",
      protocol: "5k",
    })
    expect(
      repository.listAuditEvents().filter((event) => event.kind === "time_trial_decided"),
    ).toHaveLength(2)
  })

  it("stores one import batch and reports an identical checksum as a duplicate", () => {
    const repository = new InMemoryBootcampRepository(BOOTCAMP_SEED)
    const artifact = ImportArtifactSchema.parse({
      id: "import-artifact-repository",
      participantId: "membership-participant-01",
      format: "csv",
      originalFilename: "run.csv",
      checksum: "abcdef1234567890",
      byteSize: 100,
      importedAt: "2026-08-29T09:00:00+09:00",
    })
    const draft = MetricDraftSchema.parse({
      id: "metric-draft-repository",
      artifactId: artifact.id,
      participantId: artifact.participantId,
      metric: "distance",
      unit: "m",
      value: 5_000,
      observedAt: "2026-08-29T07:00:00+09:00",
      provenance: { adapter: "csv", sourceRecord: "row-2" },
      warnings: ["representative_adapter_not_vendor_complete"],
    })

    const stored = repository.storeImport(artifact, [draft])
    const duplicate = repository.storeImport(
      ImportArtifactSchema.parse({ ...artifact, id: "import-artifact-copy" }),
      [draft],
    )

    expect(stored.kind).toBe("stored")
    expect(duplicate.kind).toBe("duplicate")
    expect(repository.listMetricDrafts(artifact.participantId)).toHaveLength(1)
  })

  it("scopes checksum dedupe to the participant without leaking another participant artifact", () => {
    const repository = new InMemoryBootcampRepository(BOOTCAMP_SEED)
    const firstArtifact = ImportArtifactSchema.parse({
      id: "import-artifact-participant-01",
      participantId: "membership-participant-01",
      format: "csv",
      originalFilename: "participant-01.csv",
      checksum: "deadbeef12345678",
      byteSize: 100,
      importedAt: "2026-08-29T09:00:00+09:00",
    })
    const secondArtifact = ImportArtifactSchema.parse({
      ...firstArtifact,
      id: "import-artifact-participant-02",
      participantId: "membership-participant-02",
      originalFilename: "participant-02.csv",
    })
    const firstDraft = MetricDraftSchema.parse({
      id: "metric-draft-participant-01",
      artifactId: firstArtifact.id,
      participantId: firstArtifact.participantId,
      metric: "distance",
      unit: "m",
      value: 5_000,
      observedAt: "2026-08-29T07:00:00+09:00",
      provenance: { adapter: "csv", sourceRecord: "row-2" },
      warnings: ["representative_adapter_not_vendor_complete"],
    })
    const secondDraft = MetricDraftSchema.parse({
      ...firstDraft,
      id: "metric-draft-participant-02",
      artifactId: secondArtifact.id,
      participantId: secondArtifact.participantId,
    })

    const first = repository.storeImport(firstArtifact, [firstDraft])
    const second = repository.storeImport(secondArtifact, [secondDraft])

    expect(first.kind).toBe("stored")
    expect(second).toMatchObject({
      kind: "stored",
      artifact: { participantId: secondArtifact.participantId },
    })
    expect(repository.listMetricDrafts(firstArtifact.participantId)).toEqual([firstDraft])
    expect(repository.listMetricDrafts(secondArtifact.participantId)).toEqual([secondDraft])
  })

  it("rejects empty import batches without recording an import audit event", () => {
    const repository = new InMemoryBootcampRepository(BOOTCAMP_SEED)
    const artifact = ImportArtifactSchema.parse({
      id: "import-artifact-empty",
      participantId: "membership-participant-01",
      format: "csv",
      originalFilename: "empty.csv",
      checksum: "facefeed12345678",
      byteSize: 0,
      importedAt: "2026-08-29T09:00:00+09:00",
    })

    const result = repository.storeImport(artifact, [])

    expect(result).toEqual({ kind: "rejected", reason: "empty_drafts" })
    expect(repository.listAuditEvents()).toEqual([])
  })

  it("keeps health sharing off until item consent and turns it off after revocation", () => {
    const repository = new InMemoryBootcampRepository(BOOTCAMP_SEED)
    const item = { kind: "health_metric", id: BOOTCAMP_SEED.healthMetrics[0]?.id } as const
    const query = {
      participantId: BOOTCAMP_SEED.healthMetrics[0]?.participantId,
      audience: "coach",
      item,
    } as const
    const grant = ConsentGrantSchema.parse({
      id: "consent-grant-repository",
      ...query,
      grantedAt: "2026-08-29T10:00:00+09:00",
    })

    expect(repository.canShare(query)).toBe(false)
    repository.grantConsent(grant)
    expect(repository.canShare(query)).toBe(true)
    repository.revokeConsent(
      ConsentRevocationSchema.parse({
        id: "consent-revocation-repository",
        grantId: grant.id,
        participantId: grant.participantId,
        revokedAt: "2026-08-30T10:00:00+09:00",
      }),
    )
    expect(repository.canShare(query)).toBe(false)
    expect(repository.listAuditEvents().map((event) => event.kind)).toEqual([
      "consent_granted",
      "consent_revoked",
    ])
  })

  it("rejects cross-participant, missing, and repeated consent revocations without an audit", () => {
    const repository = new InMemoryBootcampRepository(BOOTCAMP_SEED)
    const metric = BOOTCAMP_SEED.healthMetrics[0]
    expect(metric).toBeDefined()
    if (metric === undefined) return
    const query = {
      participantId: metric.participantId,
      audience: "coach",
      item: { kind: "health_metric", id: metric.id },
    } as const
    const grant = repository.grantConsent({
      id: "consent-grant-protected",
      ...query,
      grantedAt: "2026-08-29T10:00:00+09:00",
    })
    const crossParticipant = repository.revokeConsent({
      id: "consent-revocation-cross-user",
      grantId: grant.id,
      participantId: "membership-participant-02",
      revokedAt: "2026-08-30T10:00:00+09:00",
    })
    const missing = repository.revokeConsent({
      id: "consent-revocation-missing",
      grantId: "consent-grant-missing",
      participantId: grant.participantId,
      revokedAt: "2026-08-30T10:01:00+09:00",
    })

    expect(crossParticipant).toEqual({ kind: "rejected", reason: "participant_mismatch" })
    expect(missing).toEqual({ kind: "rejected", reason: "grant_not_found" })
    expect(repository.canShare(query)).toBe(true)
    expect(repository.listAuditEvents().map((event) => event.kind)).toEqual(["consent_granted"])

    const valid = repository.revokeConsent({
      id: "consent-revocation-valid",
      grantId: grant.id,
      participantId: grant.participantId,
      revokedAt: "2026-08-30T10:02:00+09:00",
    })
    const repeated = repository.revokeConsent({
      id: "consent-revocation-repeated",
      grantId: grant.id,
      participantId: grant.participantId,
      revokedAt: "2026-08-30T10:03:00+09:00",
    })

    expect(valid.kind).toBe("revoked")
    expect(repeated).toEqual({ kind: "rejected", reason: "already_revoked" })
    expect(repository.canShare(query)).toBe(false)
    expect(repository.listAuditEvents().map((event) => event.kind)).toEqual([
      "consent_granted",
      "consent_revoked",
    ])
  })
})
