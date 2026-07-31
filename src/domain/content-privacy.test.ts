import { describe, expect, it } from "vitest"
import {
  CommentSchema,
  FeedbackApprovalSchema,
  FeedbackDraftSchema,
  FeedPostSchema,
  NoticeSchema,
  NotificationSchema,
  ReactionSchema,
} from "./content"
import { AuditEventSchema, ConsentGrantSchema, ConsentRevocationSchema } from "./privacy"

describe("content and privacy boundaries", () => {
  it("parses coach and social content entities", () => {
    const values = [
      NoticeSchema.safeParse({
        id: "notice-week-01",
        programId: "program-run-change-2026",
        authorId: "membership-coach",
        title: "Week one",
        body: "Meet at the track.",
        audience: "participants",
        publishedAt: "2026-08-24T09:00:00+09:00",
      }),
      FeedPostSchema.safeParse({
        id: "feed-post-01",
        programId: "program-run-change-2026",
        authorId: "membership-participant-01",
        kind: "assignment_completion",
        body: "Finished my easy run.",
        createdAt: "2026-08-29T09:00:00+09:00",
      }),
      CommentSchema.safeParse({
        id: "comment-01",
        postId: "feed-post-01",
        authorId: "membership-participant-02",
        body: "Nice work!",
        createdAt: "2026-08-29T09:01:00+09:00",
      }),
      ReactionSchema.safeParse({
        id: "reaction-01",
        postId: "feed-post-01",
        memberId: "membership-participant-02",
        kind: "heart",
        createdAt: "2026-08-29T09:01:00+09:00",
      }),
      NotificationSchema.safeParse({
        id: "notification-01",
        recipientId: "membership-participant-01",
        kind: "comment",
        title: "New comment",
        body: "Someone commented on your run.",
        createdAt: "2026-08-29T09:01:00+09:00",
      }),
    ]

    expect(values.every((result) => result.success)).toBe(true)
  })

  it("requires coach approval for training-change, pain, and risk feedback", () => {
    expect(
      FeedbackDraftSchema.safeParse({
        id: "feedback-draft-low",
        participantId: "membership-participant-01",
        origin: "automated",
        risk: "low",
        approval: "not_required",
        body: "You completed two sessions this week.",
        createdAt: "2026-08-30T09:00:00+09:00",
      }).success,
    ).toBe(true)
    expect(
      FeedbackDraftSchema.safeParse({
        id: "feedback-draft-risk",
        participantId: "membership-participant-01",
        origin: "automated",
        risk: "pain",
        approval: "not_required",
        body: "Increase your mileage.",
        createdAt: "2026-08-30T09:00:00+09:00",
      }).success,
    ).toBe(false)
    expect(
      FeedbackApprovalSchema.safeParse({
        id: "feedback-approval-01",
        draftId: "feedback-draft-risk",
        coachId: "membership-coach",
        decision: "approved",
        decidedAt: "2026-08-30T10:00:00+09:00",
      }).success,
    ).toBe(true)
  })

  it("models item-level consent, revocation, and their audit trail", () => {
    const grant = ConsentGrantSchema.parse({
      id: "consent-grant-01",
      participantId: "membership-participant-01",
      audience: "coach",
      item: { kind: "health_metric", id: "health-metric-01" },
      grantedAt: "2026-08-29T10:00:00+09:00",
    })
    const revocation = ConsentRevocationSchema.parse({
      id: "consent-revocation-01",
      grantId: grant.id,
      participantId: grant.participantId,
      revokedAt: "2026-08-30T10:00:00+09:00",
      reason: "Changed my mind",
    })

    expect(grant.item.kind).toBe("health_metric")
    expect(revocation.grantId).toBe(grant.id)
    expect(
      AuditEventSchema.safeParse({
        id: "audit-event-01",
        kind: "consent_revoked",
        actorId: "membership-participant-01",
        occurredAt: "2026-08-30T10:00:00+09:00",
        revocationId: revocation.id,
        grantId: grant.id,
      }).success,
    ).toBe(true)
  })
})
