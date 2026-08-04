import { describe, expect, it } from "vitest"
import {
  CommentSchema,
  FeedbackApprovalSchema,
  FeedbackDraftSchema,
  FeedPostSchema,
  NoticeSchema,
  NotificationSchema,
  ReactionSchema,
  softDeleteFeedPost,
} from "./content"
import {
  AnonymousFaqCopySchema,
  AuditEventSchema,
  archivePrivateQuestion,
  authorizeOpenAiConsent,
  ConsentGrantSchema,
  ConsentRevocationSchema,
  closePrivateQuestion,
  deletePrivateAnswer,
  deletePrivateQuestion,
  editPrivateAnswer,
  FaqParticipantOptInSchema,
  FaqRedactionProposalSchema,
  NamedCoachGrantSchema,
  optInToFaq,
  PrivateQuestionAnswerSchema,
  PrivateQuestionThreadSchema,
  publishAnonymousFaq,
  reviewFaqRedactionProposal,
  routePrivateQuestion,
  toAnonymousFaqProjection,
  unpublishAnonymousFaq,
} from "./privacy"
import { IsoDateTimeSchema } from "./values"

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
        recipientProfileId: "membership-participant-01",
        category: "reminder",
        templateKey: "program_reminder",
        audience: "participant",
        previewKind: "metadata_only",
        contentSensitivity: "metadata_only",
        title: "Program reminder",
        body: "Open PLUS Run to view this update.",
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
      programId: "program-run-change-2026",
      participantProfileId: "membership-participant-01",
      purpose: "named_coach_sensitive_metrics",
      provider: "plus_run_first_party",
      providerProjectId: null,
      endpoint: "audited_sensitive_metric_projection",
      dataClasses: ["activity_metrics", "health_metrics", "pain_metrics"],
      statedPurpose: "named_coach_sensitive_metrics",
      recipient: "named_coach",
      recipientProfileId: "membership-coach",
      audience: "participant_and_named_coach",
      control: "participant_revocable_named_grant",
      processorDisclosure: null,
      zeroDataRetentionControl: null,
      grantedAt: "2026-08-29T10:00:00+09:00",
      expiresAt: "2026-09-29T10:00:00+09:00",
      status: "active",
    })
    const revocation = ConsentRevocationSchema.parse({
      id: "consent-revocation-01",
      grantId: grant.id,
      participantId: "membership-participant-01",
      revokedAt: "2026-08-30T10:00:00+09:00",
      reason: "Changed my mind",
    })

    expect("purpose" in grant && grant.purpose).toBe("named_coach_sensitive_metrics")
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

  it("accepts only identifier-only sensitive read audit records", () => {
    const event = {
      id: "audit-sensitive-read-01",
      actorId: "membership-participant-01",
      occurredAt: "2026-08-29T10:00:00+09:00",
      kind: "sensitive_read",
      event: "sensitive.private_question.participant_metadata_read",
      projection: "participant_private_question_metadata",
      programId: "program-run-change-2026",
      subjectProfileId: "membership-participant-01",
      entityType: "private_question_thread",
      entityId: "thread-private-01",
    } as const

    expect(AuditEventSchema.safeParse(event).success).toBe(true)
    const uuidEventResult = AuditEventSchema.safeParse({
      ...event,
      actorId: "11111111-1111-4111-8111-111111111111",
      subjectProfileId: "11111111-1111-4111-8111-111111111111",
      programId: "22222222-2222-4222-8222-222222222222",
      entityId: "33333333-3333-4333-8333-333333333333",
    })
    expect(uuidEventResult.success).toBe(true)
    for (const key of ["body", "value", "prompt", "details"] as const)
      expect(AuditEventSchema.safeParse({ ...event, [key]: "private payload" }).success).toBe(false)
    expect(
      AuditEventSchema.safeParse({
        ...event,
        projection: "named_coach_private_question_metadata",
      }).success,
    ).toBe(false)
  })

  it("Given an affirmative screenshot consent, When the canonical grant is parsed, Then its exact AI contract is accepted", () => {
    const result = ConsentGrantSchema.safeParse({
      id: "consent-grant-screenshot",
      programId: "program-run-change-2026",
      participantProfileId: "membership-participant-01",
      purpose: "screenshot_ai",
      provider: "openai",
      providerProjectId: "proj-plus-run-zdr",
      endpoint: "/v1/responses",
      dataClasses: ["server_sanitized_screenshot_pixels", "reviewable_metric_draft"],
      statedPurpose: "screenshot_metric_draft_extraction",
      recipient: "openai",
      recipientProfileId: null,
      audience: "processor_for_participant_draft_only",
      control: "per_request_participant_review",
      processorDisclosure: "openai_subprocessor_disclosed",
      zeroDataRetentionControl: "approved_project_endpoint_zdr",
      grantedAt: "2026-08-29T10:00:00+09:00",
      expiresAt: "2026-09-29T10:00:00+09:00",
      status: "active",
    })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.audience).toBe("processor_for_participant_draft_only")
  })

  it("keeps the strict legacy item-grant branch for repository compatibility without changing canonical audiences", () => {
    const legacy = ConsentGrantSchema.safeParse({
      id: "consent-grant-legacy",
      participantId: "membership-participant-01",
      audience: "coach",
      item: { kind: "health_metric", id: "health-metric-legacy" },
      grantedAt: "2026-08-29T10:00:00+09:00",
    })

    expect(legacy.success).toBe(true)
    if (legacy.success) expect(legacy.data.audience).toBe("coach")
    expect(
      ConsentGrantSchema.safeParse({
        id: "consent-grant-alias",
        participantProfileId: "membership-participant-01",
        participantId: "membership-participant-01",
        purpose: "named_coach_sensitive_metrics",
      }).success,
    ).toBe(false)
  })

  it("Given a consent substitution, When its provider, ZDR control, or endpoint alias is changed, Then the grant is rejected", () => {
    const canonical = {
      id: "consent-grant-substitution",
      programId: "program-run-change-2026",
      participantProfileId: "membership-participant-01",
      purpose: "screenshot_ai",
      provider: "openai",
      providerProjectId: "proj-plus-run-zdr",
      endpoint: "/v1/responses",
      dataClasses: ["server_sanitized_screenshot_pixels", "reviewable_metric_draft"],
      statedPurpose: "screenshot_metric_draft_extraction",
      recipient: "openai",
      recipientProfileId: null,
      audience: "processor_for_participant_draft_only",
      control: "per_request_participant_review",
      processorDisclosure: "openai_subprocessor_disclosed",
      zeroDataRetentionControl: "approved_project_endpoint_zdr",
      grantedAt: "2026-08-29T10:00:00+09:00",
      expiresAt: "2026-09-29T10:00:00+09:00",
      status: "active",
    } as const

    expect(
      ConsentGrantSchema.safeParse({ ...canonical, provider: "anthropic", recipient: "anthropic" })
        .success,
    ).toBe(false)
    expect(
      ConsentGrantSchema.safeParse({ ...canonical, zeroDataRetentionControl: "store_false" })
        .success,
    ).toBe(false)
    expect(
      ConsentGrantSchema.safeParse({ ...canonical, endpoint: "responses_api_image_input" }).success,
    ).toBe(false)
    const parsedCanonical = ConsentGrantSchema.parse(canonical)
    const authorization = {
      expectedPurpose: "screenshot_ai" as const,
      expectedProjectId: "proj-plus-run-zdr",
      now: IsoDateTimeSchema.parse("2026-08-29T12:00:00+09:00"),
    }
    expect(authorizeOpenAiConsent({ ...authorization, grant: parsedCanonical })).toBe(true)
    expect(authorizeOpenAiConsent({ ...authorization, grant: null })).toBe(false)
    expect(
      authorizeOpenAiConsent({
        ...authorization,
        grant: {
          id: "consent-grant-legacy",
          participantId: "membership-participant-01",
          audience: "coach",
          item: { kind: "health_metric", id: "health-metric-legacy" },
          grantedAt: "2026-08-29T10:00:00+09:00",
        },
      }),
    ).toBe(false)
    expect(
      authorizeOpenAiConsent({
        ...authorization,
        grant: { ...canonical, purpose: "generative_feedback_ai" },
      }),
    ).toBe(false)
    expect(
      authorizeOpenAiConsent({
        ...authorization,
        grant: {
          ...canonical,
          status: "withdrawn",
          withdrawnAt: "2026-08-30T10:00:00+09:00",
          withdrawnByProfileId: "membership-participant-01",
          withdrawalReasonCode: "participant_requested",
        },
      }),
    ).toBe(false)
    expect(
      authorizeOpenAiConsent({
        ...authorization,
        now: IsoDateTimeSchema.parse("2026-08-28T12:00:00+09:00"),
        grant: canonical,
      }),
    ).toBe(false)
    expect(
      authorizeOpenAiConsent({
        ...authorization,
        now: IsoDateTimeSchema.parse("2026-10-01T12:00:00+09:00"),
        grant: canonical,
      }),
    ).toBe(false)
    expect(
      authorizeOpenAiConsent({
        ...authorization,
        expectedProjectId: "proj-wrong-zdr",
        grant: canonical,
      }),
    ).toBe(false)
  })

  it("Given the privacy domain module, When private-question contracts are requested, Then strict Q&A schemas are exported", async () => {
    const privacyModule = await import("./privacy")

    expect(Object.hasOwn(privacyModule, "PrivateQuestionThreadSchema")).toBe(true)
    expect(Object.hasOwn(privacyModule, "PrivateQuestionAnswerSchema")).toBe(true)
    expect(Object.hasOwn(privacyModule, "AnonymousFaqCopySchema")).toBe(true)
  })

  it("Given a notification containing a private body, When metadata is parsed, Then sensitive text is rejected", () => {
    const canonical = {
      id: "notification-private-body",
      recipientProfileId: "membership-participant-01",
      category: "feedback",
      title: "Coach feedback available",
      body: "Open PLUS Run to view this update.",
      containsSensitiveData: false,
      templateKey: "feedback_available",
      audience: "participant",
      previewKind: "metadata_only",
      contentSensitivity: "metadata_only",
      createdAt: "2026-08-29T09:01:00+09:00",
    } as const

    expect(NotificationSchema.safeParse(canonical).success).toBe(true)
    expect(
      NotificationSchema.safeParse({
        ...canonical,
        body: "Pain in my left knee after the session",
      }).success,
    ).toBe(false)
  })

  it("Given a health-origin feed draft, When publication is attempted, Then the feed contract rejects it", () => {
    const result = FeedPostSchema.safeParse({
      id: "feed-post-health",
      programId: "program-run-change-2026",
      authorId: "membership-participant-01",
      kind: "reflection",
      body: "My pain score was 7 today.",
      createdAt: "2026-08-29T09:00:00+09:00",
      contentOrigin: "health",
    })

    expect(result.success).toBe(false)
    expect(
      FeedPostSchema.safeParse({
        id: "feed-post-reflection-default-origin",
        programId: "program-run-change-2026",
        authorId: "membership-participant-01",
        kind: "reflection",
        body: "A reflection must not fall back to social origin.",
        createdAt: "2026-08-29T09:00:00+09:00",
      }).success,
    ).toBe(false)
    expect(
      CommentSchema.safeParse({
        id: "comment-achievement-origin",
        postId: "feed-post-01",
        authorId: "membership-participant-02",
        body: "Achievement-origin comments are not social comments.",
        contentOrigin: "achievement",
        createdAt: "2026-08-29T09:01:00+09:00",
      }).success,
    ).toBe(false)
  })

  it("requires complete deletion and withdrawal metadata for sensitive lifecycle rows", () => {
    const answer = PrivateQuestionAnswerSchema.safeParse({
      id: "answer-01",
      threadId: "thread-01",
      programId: "program-run-change-2026",
      authorProfileId: "membership-coach",
      answerBody: "Private answer",
      status: "deleted",
      deletedAt: "2026-08-30T10:00:00+09:00",
      createdAt: "2026-08-29T09:00:00+09:00",
      updatedAt: "2026-08-30T10:00:00+09:00",
    })
    const optIn = FaqParticipantOptInSchema.safeParse({
      id: "opt-in-01",
      proposalId: "proposal-01",
      threadId: "thread-01",
      programId: "program-run-change-2026",
      participantProfileId: "membership-participant-01",
      copySha256: "a".repeat(64),
      optedInAt: "2026-08-29T10:00:00+09:00",
      status: "withdrawn",
      withdrawnAt: "2026-08-30T10:00:00+09:00",
      createdAt: "2026-08-29T09:00:00+09:00",
    })
    const namedCoach = NamedCoachGrantSchema.safeParse({
      id: "named-coach-grant-01",
      consentGrantId: "consent-grant-01",
      programId: "program-run-change-2026",
      participantProfileId: "membership-participant-01",
      coachProfileId: "membership-coach",
      grantedAt: "2026-08-29T10:00:00+09:00",
      expiresAt: "2026-09-29T10:00:00+09:00",
      status: "withdrawn",
      withdrawnAt: "2026-08-30T10:00:00+09:00",
    })
    const wrongOptInWithdrawer = FaqParticipantOptInSchema.safeParse({
      id: "opt-in-wrong-withdrawer",
      proposalId: "proposal-01",
      threadId: "thread-01",
      programId: "program-run-change-2026",
      participantProfileId: "membership-participant-01",
      copySha256: "a".repeat(64),
      optedInAt: "2026-08-29T10:00:00+09:00",
      status: "withdrawn",
      withdrawnAt: "2026-08-30T10:00:00+09:00",
      withdrawnByProfileId: "membership-coach",
      withdrawalReasonCode: "participant_requested",
      createdAt: "2026-08-29T09:00:00+09:00",
    })
    const wrongCoachWithdrawer = NamedCoachGrantSchema.safeParse({
      id: "named-coach-grant-wrong-withdrawer",
      consentGrantId: "consent-grant-01",
      programId: "program-run-change-2026",
      participantProfileId: "membership-participant-01",
      coachProfileId: "membership-coach",
      grantedAt: "2026-08-29T10:00:00+09:00",
      expiresAt: "2026-09-29T10:00:00+09:00",
      status: "withdrawn",
      withdrawnAt: "2026-08-30T10:00:00+09:00",
      withdrawnByProfileId: "membership-coach",
      withdrawalReasonCode: "participant_requested",
    })
    const wrongConsentWithdrawer = ConsentGrantSchema.safeParse({
      id: "consent-grant-wrong-withdrawer",
      programId: "program-run-change-2026",
      participantProfileId: "membership-participant-01",
      purpose: "screenshot_ai",
      provider: "openai",
      providerProjectId: "proj-plus-run-zdr",
      endpoint: "/v1/responses",
      dataClasses: ["server_sanitized_screenshot_pixels", "reviewable_metric_draft"],
      statedPurpose: "screenshot_metric_draft_extraction",
      recipient: "openai",
      recipientProfileId: null,
      audience: "processor_for_participant_draft_only",
      control: "per_request_participant_review",
      processorDisclosure: "openai_subprocessor_disclosed",
      zeroDataRetentionControl: "approved_project_endpoint_zdr",
      grantedAt: "2026-08-29T10:00:00+09:00",
      expiresAt: "2026-09-29T10:00:00+09:00",
      status: "withdrawn",
      withdrawnAt: "2026-08-30T10:00:00+09:00",
      withdrawnByProfileId: "membership-coach",
      withdrawalReasonCode: "participant_requested",
    })

    expect(answer.success).toBe(false)
    expect(optIn.success).toBe(false)
    expect(namedCoach.success).toBe(false)
    expect(wrongOptInWithdrawer.success).toBe(false)
    expect(wrongCoachWithdrawer.success).toBe(false)
    expect(wrongConsentWithdrawer.success).toBe(false)
  })

  it("preserves closed history through archive/delete and binds private-question routing and answers", () => {
    const openThread = PrivateQuestionThreadSchema.parse({
      id: "thread-lifecycle-01",
      programId: "program-run-change-2026",
      participantProfileId: "membership-participant-01",
      questionBody: "Lifecycle question",
      contentOrigin: "general",
      contentSensitivity: "private",
      createdAt: "2026-08-29T09:00:00+09:00",
      updatedAt: "2026-08-29T09:00:00+09:00",
    })
    const closed = closePrivateQuestion({
      thread: openThread,
      actorProfileId: openThread.participantProfileId,
      at: IsoDateTimeSchema.parse("2026-08-29T10:00:00+09:00"),
    })
    const archived = archivePrivateQuestion({
      thread: closed,
      actorProfileId: openThread.participantProfileId,
      at: IsoDateTimeSchema.parse("2026-08-29T11:00:00+09:00"),
    })
    const deleted = deletePrivateQuestion({
      thread: closed,
      actorProfileId: openThread.participantProfileId,
      at: IsoDateTimeSchema.parse("2026-08-29T11:00:00+09:00"),
    })
    expect(archived.closedAt).toBe(closed.closedAt)
    expect(archived.closedByProfileId).toBe(closed.closedByProfileId)
    expect(deleted.closedAt).toBe(closed.closedAt)
    expect(deleted.closedByProfileId).toBe(closed.closedByProfileId)
    expect(
      PrivateQuestionThreadSchema.safeParse({
        ...closed,
        status: "archived",
        closedByProfileId: null,
        archivedAt: "2026-08-29T11:00:00+09:00",
        archivedByProfileId: openThread.participantProfileId,
      }).success,
    ).toBe(false)

    const answered = routePrivateQuestion({
      thread: openThread,
      actorProfileId: "membership-coach",
      namedCoachProfileId: "membership-coach",
      routingStatus: "answered",
      activeAnswerCount: 1,
      at: IsoDateTimeSchema.parse("2026-08-29T12:00:00+09:00"),
    })
    expect(answered.routingStatus).toBe("answered")
    expect(
      routePrivateQuestion({
        thread: openThread,
        actorProfileId: "membership-coach",
        namedCoachProfileId: "membership-coach",
        routingStatus: "needs_followup",
        at: IsoDateTimeSchema.parse("2026-08-29T12:00:00+09:00"),
      }).routingStatus,
    ).toBe("needs_followup")
    expect(() =>
      routePrivateQuestion({
        thread: openThread,
        actorProfileId: "membership-participant-02",
        namedCoachProfileId: "membership-coach",
        routingStatus: "needs_followup",
        at: IsoDateTimeSchema.parse("2026-08-29T12:00:00+09:00"),
      }),
    ).toThrow("forbidden")
    expect(() =>
      routePrivateQuestion({
        thread: openThread,
        actorProfileId: "membership-coach",
        namedCoachProfileId: "membership-coach",
        routingStatus: "answered",
        activeAnswerCount: 0,
        at: IsoDateTimeSchema.parse("2026-08-29T12:00:00+09:00"),
      }),
    ).toThrow("invalid_transition")
    expect(() =>
      routePrivateQuestion({
        thread: openThread,
        actorProfileId: "membership-coach",
        namedCoachProfileId: "membership-coach",
        routingStatus: "unanswered",
        activeAnswerCount: 1,
        at: IsoDateTimeSchema.parse("2026-08-29T12:00:00+09:00"),
      }),
    ).toThrow("invalid_transition")
    expect(() =>
      routePrivateQuestion({
        thread: openThread,
        actorProfileId: "membership-coach",
        namedCoachProfileId: "membership-coach",
        routingStatus: "answered",
        activeAnswerCount: 1,
        hasActiveAnswer: false,
        at: IsoDateTimeSchema.parse("2026-08-29T12:00:00+09:00"),
      }),
    ).toThrow("invalid_transition")

    const answer = PrivateQuestionAnswerSchema.parse({
      id: "answer-action-01",
      threadId: openThread.id,
      programId: openThread.programId,
      authorProfileId: "membership-coach",
      answerBody: "Private answer",
      createdAt: "2026-08-29T12:00:00+09:00",
      updatedAt: "2026-08-29T12:00:00+09:00",
    })
    const editedAnswer = editPrivateAnswer({
      answer,
      thread: openThread,
      actorProfileId: "membership-coach",
      namedCoachProfileId: "membership-coach",
      body: "Edited private answer",
      at: IsoDateTimeSchema.parse("2026-08-29T13:00:00+09:00"),
    })
    const deletedAnswer = deletePrivateAnswer({
      answer: editedAnswer,
      thread: openThread,
      actorProfileId: "membership-coach",
      namedCoachProfileId: "membership-coach",
      at: IsoDateTimeSchema.parse("2026-08-29T14:00:00+09:00"),
    })
    expect(editedAnswer.answerBody).toBe("Edited private answer")
    expect(deletedAnswer.status).toBe("deleted")
    expect(() =>
      editPrivateAnswer({
        answer,
        thread: openThread,
        actorProfileId: "membership-participant-02",
        namedCoachProfileId: "membership-coach",
        body: "forged",
        at: IsoDateTimeSchema.parse("2026-08-29T13:00:00+09:00"),
      }),
    ).toThrow("forbidden")
    expect(() =>
      deletePrivateAnswer({
        answer: deletedAnswer,
        thread: openThread,
        actorProfileId: "membership-coach",
        namedCoachProfileId: "membership-coach",
        at: IsoDateTimeSchema.parse("2026-08-29T15:00:00+09:00"),
      }),
    ).toThrow("invalid_transition")
    expect(() =>
      editPrivateAnswer({
        answer,
        thread: closed,
        actorProfileId: "membership-coach",
        namedCoachProfileId: "membership-coach",
        body: "closed-thread edit",
        at: IsoDateTimeSchema.parse("2026-08-29T13:00:00+09:00"),
      }),
    ).toThrow("forbidden")
    expect(() =>
      deletePrivateAnswer({
        answer,
        thread: { ...openThread, id: "thread-other" },
        actorProfileId: "membership-coach",
        namedCoachProfileId: "membership-coach",
        at: IsoDateTimeSchema.parse("2026-08-29T14:00:00+09:00"),
      }),
    ).toThrow("forbidden")
  })

  it("rejects partial lifecycle metadata, moderation metadata, and stale purge deadlines", () => {
    expect(
      PrivateQuestionThreadSchema.safeParse({
        id: "thread-open-partial",
        programId: "program-run-change-2026",
        participantProfileId: "membership-participant-01",
        questionBody: "Open question",
        contentOrigin: "general",
        contentSensitivity: "private",
        status: "open",
        closedAt: "2026-08-29T10:00:00+09:00",
        createdAt: "2026-08-29T09:00:00+09:00",
        updatedAt: "2026-08-29T09:00:00+09:00",
      }).success,
    ).toBe(false)
    expect(
      FaqRedactionProposalSchema.safeParse({
        id: "proposal-partial",
        threadId: "thread-01",
        programId: "program-run-change-2026",
        proposedByProfileId: "membership-coach",
        redactedQuestion: "Question",
        redactedAnswer: "Answer",
        redactedCopySha256: "a".repeat(64),
        reviewStatus: "pending",
        reviewedAt: "2026-08-29T10:00:00+09:00",
        createdAt: "2026-08-29T09:00:00+09:00",
        updatedAt: "2026-08-29T09:00:00+09:00",
      }).success,
    ).toBe(false)
    expect(
      AnonymousFaqCopySchema.safeParse({
        id: "faq-partial",
        programId: "program-run-change-2026",
        sourceThreadId: "thread-01",
        sourceProposalId: "proposal-01",
        participantOptInId: "opt-in-01",
        questionCopy: "Question",
        answerCopy: "Answer",
        publicationStatus: "published",
        publishedByProfileId: "staff-reviewer-01",
        unpublishedAt: "2026-08-30T10:00:00+09:00",
        createdAt: "2026-08-29T09:00:00+09:00",
        publishedAt: "2026-08-29T09:00:00+09:00",
      }).success,
    ).toBe(false)
    expect(
      CommentSchema.safeParse({
        id: "comment-moderation-partial",
        postId: "feed-post-01",
        authorId: "membership-participant-02",
        body: "Comment",
        moderationState: "visible",
        moderatedAt: "2026-08-29T10:00:00+09:00",
        createdAt: "2026-08-29T09:00:00+09:00",
      }).success,
    ).toBe(false)
    expect(
      FeedPostSchema.safeParse({
        id: "feed-post-stale-purge",
        programId: "program-run-change-2026",
        authorId: "membership-participant-01",
        kind: "assignment_completion",
        body: "Finished my easy run.",
        deleteState: "soft_deleted",
        deletedAt: "2026-08-29T10:00:00+09:00",
        purgeAfter: "2026-08-29T10:00:00+09:00",
        createdAt: "2026-08-29T09:00:00+09:00",
      }).success,
    ).toBe(false)
  })

  it("requires exact FAQ source, opt-in, and participant linkage and rejects hostile reversal", () => {
    const thread = PrivateQuestionThreadSchema.parse({
      id: "thread-private-01",
      programId: "program-run-change-2026",
      participantProfileId: "membership-participant-01",
      questionBody: "How should I structure this drill?",
      contentOrigin: "general",
      contentSensitivity: "private",
      createdAt: "2026-08-29T09:00:00+09:00",
      updatedAt: "2026-08-29T09:00:00+09:00",
    })
    const proposal = FaqRedactionProposalSchema.parse({
      id: "proposal-01",
      threadId: thread.id,
      programId: thread.programId,
      proposedByProfileId: "membership-coach",
      redactedQuestion: "How should I structure this drill?",
      redactedAnswer: "Use the approved training plan.",
      redactedCopySha256: "a".repeat(64),
      reviewStatus: "approved",
      reviewedByProfileId: "staff-reviewer-01",
      reviewedAt: "2026-08-29T10:00:00+09:00",
      reviewControl: "named_staff_redaction_review",
      createdAt: "2026-08-29T09:30:00+09:00",
      updatedAt: "2026-08-29T10:00:00+09:00",
    })
    const pendingProposal = FaqRedactionProposalSchema.parse({
      ...proposal,
      id: "proposal-pending-action",
      reviewStatus: "pending",
      reviewedByProfileId: undefined,
      reviewedAt: undefined,
      reviewControl: undefined,
      createdAt: "2026-08-29T09:30:00+09:00",
      updatedAt: "2026-08-29T09:30:00+09:00",
    })
    expect(() =>
      reviewFaqRedactionProposal({
        proposal: pendingProposal,
        reviewerProfileId: "staff-reviewer-01",
        authorizedStaffProfileId: "membership-coach",
        decision: "approved",
        reviewedAt: IsoDateTimeSchema.parse("2026-08-29T10:00:00+09:00"),
      }),
    ).toThrow("forbidden")
    expect(
      reviewFaqRedactionProposal({
        proposal: pendingProposal,
        reviewerProfileId: "staff-reviewer-01",
        authorizedStaffProfileId: "staff-reviewer-01",
        decision: "approved",
        reviewedAt: IsoDateTimeSchema.parse("2026-08-29T10:00:00+09:00"),
      }).reviewStatus,
    ).toBe("approved")
    const optIn = FaqParticipantOptInSchema.parse({
      id: "opt-in-01",
      proposalId: proposal.id,
      threadId: thread.id,
      programId: thread.programId,
      participantProfileId: thread.participantProfileId,
      copySha256: proposal.redactedCopySha256,
      optedInAt: "2026-08-29T10:30:00+09:00",
      createdAt: "2026-08-29T10:30:00+09:00",
    })
    expect(
      optInToFaq({
        proposal,
        thread,
        actorProfileId: thread.participantProfileId,
        participantProfileId: thread.participantProfileId,
        threadId: thread.id,
        programId: thread.programId,
        copySha256: proposal.redactedCopySha256,
        optedInAt: IsoDateTimeSchema.parse("2026-08-29T10:30:00+09:00"),
        id: "opt-in-action-01",
        createdAt: IsoDateTimeSchema.parse("2026-08-29T10:30:00+09:00"),
      }).participantProfileId,
    ).toBe(thread.participantProfileId)
    expect(() =>
      optInToFaq({
        proposal,
        thread,
        actorProfileId: "membership-participant-02",
        participantProfileId: "membership-participant-02",
        threadId: thread.id,
        programId: thread.programId,
        copySha256: proposal.redactedCopySha256,
        optedInAt: IsoDateTimeSchema.parse("2026-08-29T10:30:00+09:00"),
        id: "opt-in-action-hostile",
        createdAt: IsoDateTimeSchema.parse("2026-08-29T10:30:00+09:00"),
      }),
    ).toThrow("exact_copy_required")
    const copy = publishAnonymousFaq({
      id: "faq-copy-01",
      proposal,
      optIn,
      thread,
      publishedByProfileId: "membership-coach",
      activeNamedCoachProfileId: "membership-coach",
      publishedAt: IsoDateTimeSchema.parse("2026-08-29T11:00:00+09:00"),
      createdAt: IsoDateTimeSchema.parse("2026-08-29T11:00:00+09:00"),
    })

    expect(copy.participantProfileId).toBe(thread.participantProfileId)
    expect(
      FaqRedactionProposalSchema.safeParse({
        ...proposal,
        reviewedAt: "2026-08-29T09:00:00+09:00",
      }).success,
    ).toBe(false)
    expect(
      FaqParticipantOptInSchema.safeParse({
        ...optIn,
        status: "withdrawn",
        withdrawnAt: "2026-08-29T10:00:00+09:00",
        withdrawnByProfileId: thread.participantProfileId,
        withdrawalReasonCode: "participant_requested",
      }).success,
    ).toBe(false)
    expect(
      AnonymousFaqCopySchema.safeParse({
        ...copy,
        publicationStatus: "unpublished",
        unpublishedByProfileId: thread.participantProfileId,
        unpublishedAt: "2026-08-29T10:00:00+09:00",
        purgeAfter: "2026-09-28T10:00:00+09:00",
      }).success,
    ).toBe(false)
    expect(() =>
      publishAnonymousFaq({
        id: "faq-copy-noncoach",
        proposal,
        optIn,
        thread,
        publishedByProfileId: "staff-reviewer-01",
        activeNamedCoachProfileId: "membership-coach",
        publishedAt: IsoDateTimeSchema.parse("2026-08-29T11:00:00+09:00"),
        createdAt: IsoDateTimeSchema.parse("2026-08-29T11:00:00+09:00"),
      }),
    ).toThrow("forbidden")
    expect(() =>
      unpublishAnonymousFaq({
        copy,
        actorProfileId: "membership-coach",
        unpublishedAt: IsoDateTimeSchema.parse("2026-08-30T11:00:00+09:00"),
      }),
    ).toThrow("forbidden")
    expect(
      unpublishAnonymousFaq({
        copy,
        actorProfileId: "membership-coach",
        activeNamedCoachProfileId: "membership-coach",
        unpublishedAt: IsoDateTimeSchema.parse("2026-08-30T11:00:00+09:00"),
      }).publicationStatus,
    ).toBe("unpublished")
    expect(() =>
      publishAnonymousFaq({
        id: "faq-copy-hostile",
        proposal: { ...proposal, threadId: "thread-substituted" },
        optIn,
        thread,
        publishedByProfileId: "membership-coach",
        activeNamedCoachProfileId: "membership-coach",
        publishedAt: IsoDateTimeSchema.parse("2026-08-29T11:00:00+09:00"),
        createdAt: IsoDateTimeSchema.parse("2026-08-29T11:00:00+09:00"),
      }),
    ).toThrow("exact_copy_required")
    expect(() =>
      unpublishAnonymousFaq({
        copy,
        actorProfileId: "unrelated-profile",
        unpublishedAt: IsoDateTimeSchema.parse("2026-08-30T11:00:00+09:00"),
      }),
    ).toThrow("forbidden")
    expect(() =>
      unpublishAnonymousFaq({
        copy,
        actorProfileId: thread.participantProfileId,
        unpublishedAt: IsoDateTimeSchema.parse("2026-08-30T11:00:00+09:00"),
      }),
    ).toThrow("forbidden")
    const forgedParticipantCopy = AnonymousFaqCopySchema.parse({
      ...copy,
      participantProfileId: "membership-participant-02",
    })
    expect(() =>
      unpublishAnonymousFaq({
        copy: forgedParticipantCopy,
        actorProfileId: "membership-participant-02",
        unpublishedAt: IsoDateTimeSchema.parse("2026-08-30T11:00:00+09:00"),
        optIn,
      }),
    ).toThrow("forbidden")
    const projection = toAnonymousFaqProjection(copy)
    expect(
      Object.keys(projection).some(
        (key) => key.startsWith("source") || key.includes("private") || key.includes("participant"),
      ),
    ).toBe(false)
    const unpublished = unpublishAnonymousFaq({
      copy,
      actorProfileId: thread.participantProfileId,
      unpublishedAt: IsoDateTimeSchema.parse("2026-08-30T11:00:00+09:00"),
      optIn,
    })
    expect(unpublished.sourceThreadId).toBe(thread.id)
    expect(() => toAnonymousFaqProjection(unpublished)).toThrow("invalid_transition")
  })

  it("sets a future purge deadline for author feed deletion", () => {
    const post = FeedPostSchema.parse({
      id: "feed-post-delete-01",
      programId: "program-run-change-2026",
      authorId: "membership-participant-01",
      kind: "assignment_completion",
      body: "Finished my easy run.",
      createdAt: "2026-08-29T09:00:00+09:00",
    })
    const deleted = softDeleteFeedPost({
      post,
      actorProfileId: post.authorId,
      deletedAt: IsoDateTimeSchema.parse("2026-08-29T10:00:00+09:00"),
    })
    expect(Date.parse(deleted.purgeAfter ?? "") > Date.parse(deleted.deletedAt ?? "")).toBe(true)
  })
})
