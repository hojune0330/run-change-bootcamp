import { describe, expect, it } from "vitest"
import { AssessmentResultSchema, AssessmentSessionSchema } from "./assessment"
import { HealthMetricSchema } from "./health"
import { ImportArtifactSchema, MetricDraftSchema } from "./imports-model"
import { ActivitySchema, AssignmentSchema, SubmissionSchema } from "./training"

describe("training and health boundaries", () => {
  it("parses assignments, submitted homework, and confirmed activities", () => {
    expect(
      AssignmentSchema.safeParse({
        id: "assignment-week-01",
        programId: "program-run-change-2026",
        title: "Easy run",
        kind: "running",
        status: "published",
        dueAt: "2026-08-30T23:59:00+09:00",
        publishedAt: "2026-08-24T09:00:00+09:00",
      }).success,
    ).toBe(true)
    expect(
      SubmissionSchema.safeParse({
        id: "submission-01",
        assignmentId: "assignment-week-01",
        participantId: "membership-participant-01",
        status: "submitted",
        submittedAt: "2026-08-29T08:00:00+09:00",
        note: "Comfortable effort",
      }).success,
    ).toBe(true)
    expect(
      ActivitySchema.safeParse({
        id: "activity-01",
        participantId: "membership-participant-01",
        source: "manual",
        status: "confirmed",
        occurredAt: "2026-08-29T07:00:00+09:00",
        distanceMeters: 5_000,
        durationSeconds: 1_800,
      }).success,
    ).toBe(true)
  })

  it("defaults sensitive metrics to private and rejects mismatched units", () => {
    const metric = HealthMetricSchema.parse({
      id: "health-metric-01",
      participantId: "membership-participant-01",
      metric: "resting_heart_rate",
      unit: "bpm",
      value: 58,
      recordedAt: "2026-08-29T07:00:00+09:00",
      source: "manual",
    })

    expect(metric.visibility).toBe("private")
    expect(
      HealthMetricSchema.safeParse({
        ...metric,
        metric: "body_weight",
        unit: "bpm",
      }).success,
    ).toBe(false)
  })

  it("locks assessment result shape to the selected protocol", () => {
    expect(
      AssessmentSessionSchema.safeParse({
        id: "assessment-session-initial",
        programId: "program-run-change-2026",
        purpose: "initial",
        week: 1,
        session: 2,
        scheduledOn: "2026-08-27",
        protocol: { kind: "3k" },
      }).success,
    ).toBe(true)
    expect(
      AssessmentResultSchema.safeParse({
        id: "assessment-result-01",
        assessmentSessionId: "assessment-session-initial",
        participantId: "membership-participant-01",
        protocol: "3k",
        elapsedSeconds: 900,
        status: "confirmed",
        recordedAt: "2026-08-27T10:00:00+09:00",
      }).success,
    ).toBe(true)
    expect(
      AssessmentResultSchema.safeParse({
        id: "assessment-result-02",
        assessmentSessionId: "assessment-session-initial",
        participantId: "membership-participant-01",
        protocol: "12-minute",
        elapsedSeconds: 900,
        status: "confirmed",
        recordedAt: "2026-08-27T10:00:00+09:00",
      }).success,
    ).toBe(false)
  })

  it("marks import artifacts representative-only and metrics pending review", () => {
    const artifact = ImportArtifactSchema.parse({
      id: "import-artifact-01",
      participantId: "membership-participant-01",
      format: "csv",
      originalFilename: "run.csv",
      checksum: "12345678abcdef",
      byteSize: 120,
      importedAt: "2026-08-29T09:00:00+09:00",
    })
    const draft = MetricDraftSchema.parse({
      id: "metric-draft-01",
      artifactId: artifact.id,
      participantId: artifact.participantId,
      metric: "distance",
      unit: "m",
      value: 5_000,
      observedAt: "2026-08-29T07:00:00+09:00",
      provenance: { adapter: "csv", sourceRecord: "row-2" },
      warnings: ["representative_adapter"],
    })

    expect(artifact.coverage).toBe("representative_only")
    expect(draft.status).toBe("pending_review")
    expect(MetricDraftSchema.safeParse({ ...draft, unit: "km" }).success).toBe(false)
    expect(ImportArtifactSchema.safeParse({ ...artifact, importedAt: "yesterday" }).success).toBe(
      false,
    )
  })
})
