export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      account_deletion_requests: {
        Row: {
          completed_at: string | null
          id: string
          profile_id: string
          requested_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          profile_id: string
          requested_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          profile_id?: string
          requested_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_deletion_requests_profile_id_fkey"
            columns: ["profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          error_code: string | null
          id: string
          idempotency_key: string
          last_started_at: string
          program_id: string
          provider_response_id: string | null
          request_kind: string
          requested_by: string
          status: string
          target_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          idempotency_key: string
          last_started_at?: string
          program_id: string
          provider_response_id?: string | null
          request_kind: string
          requested_by: string
          status?: string
          target_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          idempotency_key?: string
          last_started_at?: string
          program_id?: string
          provider_response_id?: string | null
          request_kind?: string
          requested_by?: string
          status?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_requests_program_id_fkey"
            columns: ["program_id"]
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_requests_requested_by_fkey"
            columns: ["requested_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string
          id: string
          program_id: string
          published_at: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          id?: string
          program_id: string
          published_at?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          program_id?: string
          published_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_program_id_fkey"
            columns: ["program_id"]
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_attempt_conditions: {
        Row: {
          attempt_id: string
          device_family: string
          measured_distance_m: number
          recorded_at: string
          route_version: string
          source_family: string
          started_local_at: string
          surface_key: string
          timezone: string
          timing_method_key: string
          warmup_protocol_key: string
        }
        Insert: {
          attempt_id: string
          device_family: string
          measured_distance_m: number
          recorded_at?: string
          route_version: string
          source_family: string
          started_local_at: string
          surface_key: string
          timezone: string
          timing_method_key: string
          warmup_protocol_key: string
        }
        Update: {
          attempt_id?: string
          device_family?: string
          measured_distance_m?: number
          recorded_at?: string
          route_version?: string
          source_family?: string
          started_local_at?: string
          surface_key?: string
          timezone?: string
          timing_method_key?: string
          warmup_protocol_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_attempt_conditions_attempt_id_fkey"
            columns: ["attempt_id"]
            referencedRelation: "assessment_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_attempts: {
        Row: {
          accepted_at: string | null
          assessment_session_id: string
          attempt_kind: string
          created_at: string
          elapsed_seconds: number
          enrollment_id: string
          id: string
          invalidated_at: string | null
          invalidation_reason_code: string | null
          original_attempt_id: string | null
          program_id: string
          protocol_version_id: string
          recorded_at: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          assessment_session_id: string
          attempt_kind: string
          created_at?: string
          elapsed_seconds: number
          enrollment_id: string
          id?: string
          invalidated_at?: string | null
          invalidation_reason_code?: string | null
          original_attempt_id?: string | null
          program_id: string
          protocol_version_id: string
          recorded_at: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          assessment_session_id?: string
          attempt_kind?: string
          created_at?: string
          elapsed_seconds?: number
          enrollment_id?: string
          id?: string
          invalidated_at?: string | null
          invalidation_reason_code?: string | null
          original_attempt_id?: string | null
          program_id?: string
          protocol_version_id?: string
          recorded_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_attempts_assessment_session_id_program_id_proto_fkey"
            columns: ["assessment_session_id", "program_id", "protocol_version_id"]
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id", "program_id", "protocol_version_id"]
          },
          {
            foreignKeyName: "assessment_attempts_enrollment_id_program_id_fkey"
            columns: ["enrollment_id", "program_id"]
            referencedRelation: "program_enrollments"
            referencedColumns: ["id", "program_id"]
          },
          {
            foreignKeyName: "assessment_attempts_original_attempt_id_fkey"
            columns: ["original_attempt_id"]
            referencedRelation: "assessment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_attempts_program_id_fkey"
            columns: ["program_id"]
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_protocol_versions: {
        Row: {
          created_at: string
          created_by: string
          id: string
          locked_at: string | null
          program_id: string
          status: string
          template_code: string
          template_version: number
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          locked_at?: string | null
          program_id: string
          status?: string
          template_code: string
          template_version: number
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          locked_at?: string | null
          program_id?: string
          status?: string
          template_code?: string
          template_version?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_protocol_versions_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_protocol_versions_program_id_fkey"
            columns: ["program_id"]
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_protocol_versions_template_code_template_versio_fkey"
            columns: ["template_code", "template_version"]
            referencedRelation: "measurement_protocol_templates"
            referencedColumns: ["code", "version"]
          },
        ]
      }
      assessment_sessions: {
        Row: {
          created_at: string
          id: string
          is_official: boolean
          program_id: string
          protocol_version_id: string
          purpose: string
          scheduled_on: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_official?: boolean
          program_id: string
          protocol_version_id: string
          purpose: string
          scheduled_on: string
        }
        Update: {
          created_at?: string
          id?: string
          is_official?: boolean
          program_id?: string
          protocol_version_id?: string
          purpose?: string
          scheduled_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_sessions_program_id_fkey"
            columns: ["program_id"]
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_sessions_protocol_version_id_program_id_fkey"
            columns: ["protocol_version_id", "program_id"]
            referencedRelation: "assessment_protocol_versions"
            referencedColumns: ["id", "program_id"]
          },
        ]
      }
      assignments: {
        Row: {
          assignment_kind: string
          created_at: string
          created_by: string
          due_at: string | null
          id: string
          instructions: string
          program_id: string
          published_at: string | null
          session_id: string | null
          title: string
        }
        Insert: {
          assignment_kind: string
          created_at?: string
          created_by: string
          due_at?: string | null
          id?: string
          instructions: string
          program_id: string
          published_at?: string | null
          session_id?: string | null
          title: string
        }
        Update: {
          assignment_kind?: string
          created_at?: string
          created_by?: string
          due_at?: string | null
          id?: string
          instructions?: string
          program_id?: string
          published_at?: string | null
          session_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_program_id_fkey"
            columns: ["program_id"]
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_session_id_fkey"
            columns: ["session_id"]
            referencedRelation: "program_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          actor_profile_id: string | null
          details: Json
          entity_id: string | null
          entity_type: string
          event_type: string
          id: number
          occurred_at: string
          organization_id: string | null
          subject_profile_id: string | null
        }
        Insert: {
          actor_profile_id?: string | null
          details?: Json
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: never
          occurred_at?: string
          organization_id?: string | null
          subject_profile_id?: string | null
        }
        Update: {
          actor_profile_id?: string | null
          details?: Json
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: never
          occurred_at?: string
          organization_id?: string | null
          subject_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_subject_profile_id_fkey"
            columns: ["subject_profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_uploads: {
        Row: {
          bucket_id: string
          byte_size: number
          created_at: string
          detected_mime_type: string
          id: string
          object_path: string
          owner_profile_id: string
          program_id: string
          sha256: string | null
          status: string
          upload_kind: string
        }
        Insert: {
          bucket_id: string
          byte_size: number
          created_at?: string
          detected_mime_type: string
          id?: string
          object_path: string
          owner_profile_id: string
          program_id: string
          sha256?: string | null
          status?: string
          upload_kind: string
        }
        Update: {
          bucket_id?: string
          byte_size?: number
          created_at?: string
          detected_mime_type?: string
          id?: string
          object_path?: string
          owner_profile_id?: string
          program_id?: string
          sha256?: string | null
          status?: string
          upload_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_uploads_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_uploads_program_id_fkey"
            columns: ["program_id"]
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_comments: {
        Row: {
          author_profile_id: string
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          post_id: string
        }
        Insert: {
          author_profile_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          post_id: string
        }
        Update: {
          author_profile_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_comments_author_profile_id_fkey"
            columns: ["author_profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_comments_post_id_fkey"
            columns: ["post_id"]
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          author_profile_id: string
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          program_id: string
          submission_id: string | null
          visibility: string
        }
        Insert: {
          author_profile_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          program_id: string
          submission_id?: string | null
          visibility?: string
        }
        Update: {
          author_profile_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          program_id?: string
          submission_id?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_posts_author_profile_id_fkey"
            columns: ["author_profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_posts_program_id_fkey"
            columns: ["program_id"]
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_posts_submission_id_fkey"
            columns: ["submission_id"]
            referencedRelation: "homework_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_reactions: {
        Row: {
          author_profile_id: string
          created_at: string
          post_id: string
          reaction: string
        }
        Insert: {
          author_profile_id: string
          created_at?: string
          post_id: string
          reaction?: string
        }
        Update: {
          author_profile_id?: string
          created_at?: string
          post_id?: string
          reaction?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_reactions_author_profile_id_fkey"
            columns: ["author_profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_reactions_post_id_fkey"
            columns: ["post_id"]
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_items: {
        Row: {
          ai_request_id: string | null
          approved_at: string | null
          approved_by: string | null
          body: string
          classification: string
          created_at: string
          created_by: string | null
          id: string
          origin: string
          participant_id: string
          program_id: string
          published_at: string | null
          status: string
          submission_id: string | null
        }
        Insert: {
          ai_request_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          body: string
          classification: string
          created_at?: string
          created_by?: string | null
          id?: string
          origin: string
          participant_id: string
          program_id: string
          published_at?: string | null
          status?: string
          submission_id?: string | null
        }
        Update: {
          ai_request_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          body?: string
          classification?: string
          created_at?: string
          created_by?: string | null
          id?: string
          origin?: string
          participant_id?: string
          program_id?: string
          published_at?: string | null
          status?: string
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_items_ai_request_id_fkey"
            columns: ["ai_request_id"]
            referencedRelation: "ai_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_items_approved_by_fkey"
            columns: ["approved_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_items_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_items_participant_id_fkey"
            columns: ["participant_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_items_program_id_fkey"
            columns: ["program_id"]
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_items_submission_id_fkey"
            columns: ["submission_id"]
            referencedRelation: "homework_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_review_events: {
        Row: {
          created_at: string
          decision: string
          feedback_id: string
          id: number
          note: string | null
          reviewer_profile_id: string
        }
        Insert: {
          created_at?: string
          decision: string
          feedback_id: string
          id?: never
          note?: string | null
          reviewer_profile_id: string
        }
        Update: {
          created_at?: string
          decision?: string
          feedback_id?: string
          id?: never
          note?: string | null
          reviewer_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_review_events_feedback_id_fkey"
            columns: ["feedback_id"]
            referencedRelation: "feedback_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_review_events_reviewer_profile_id_fkey"
            columns: ["reviewer_profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_release_statuses: {
        Row: {
          candidate_sha: string | null
          id: string
          privacy_approved_at: string | null
          program_id: string
          program_owner_approved_at: string | null
          protocol_version_id: string
          released_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          candidate_sha?: string | null
          id?: string
          privacy_approved_at?: string | null
          program_id: string
          program_owner_approved_at?: string | null
          protocol_version_id: string
          released_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          candidate_sha?: string | null
          id?: string
          privacy_approved_at?: string | null
          program_id?: string
          program_owner_approved_at?: string | null
          protocol_version_id?: string
          released_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_release_statuses_program_id_fkey"
            columns: ["program_id"]
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_release_statuses_protocol_version_id_program_id_fkey"
            columns: ["protocol_version_id", "program_id"]
            referencedRelation: "assessment_protocol_versions"
            referencedColumns: ["id", "program_id"]
          },
        ]
      }
      homework_submissions: {
        Row: {
          assignment_id: string
          created_at: string
          id: string
          participant_id: string
          program_id: string
          response_text: string | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          id?: string
          participant_id: string
          program_id: string
          response_text?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          id?: string
          participant_id?: string
          program_id?: string
          response_text?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_submissions_participant_id_fkey"
            columns: ["participant_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_submissions_program_id_fkey"
            columns: ["program_id"]
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_protocol_templates: {
        Row: {
          administrative_end_on: string
          code: string
          distance_m: number
          festival_on: string
          intervention_endpoint_on: string
          minimum_improved_pct: number
          minimum_median_change_pct: number
          minimum_rhr_days: number
          minimum_valid_pairs: number
          official_baseline_on: string
          official_retest_on: string
          onboarding_on: string
          per_protocol_minimum_pct: number
          program_start_on: string
          rhr_baseline_end_on: string
          rhr_baseline_start_on: string
          rhr_comparison_end_on: string
          rhr_comparison_start_on: string
          schedule_anchor_on: string
          timezone: string
          version: number
        }
        Insert: {
          administrative_end_on: string
          code: string
          distance_m: number
          festival_on: string
          intervention_endpoint_on: string
          minimum_improved_pct: number
          minimum_median_change_pct: number
          minimum_rhr_days: number
          minimum_valid_pairs: number
          official_baseline_on: string
          official_retest_on: string
          onboarding_on: string
          per_protocol_minimum_pct: number
          program_start_on: string
          rhr_baseline_end_on: string
          rhr_baseline_start_on: string
          rhr_comparison_end_on: string
          rhr_comparison_start_on: string
          schedule_anchor_on: string
          timezone: string
          version: number
        }
        Update: {
          administrative_end_on?: string
          code?: string
          distance_m?: number
          festival_on?: string
          intervention_endpoint_on?: string
          minimum_improved_pct?: number
          minimum_median_change_pct?: number
          minimum_rhr_days?: number
          minimum_valid_pairs?: number
          official_baseline_on?: string
          official_retest_on?: string
          onboarding_on?: string
          per_protocol_minimum_pct?: number
          program_start_on?: string
          rhr_baseline_end_on?: string
          rhr_baseline_start_on?: string
          rhr_comparison_end_on?: string
          rhr_comparison_start_on?: string
          schedule_anchor_on?: string
          timezone?: string
          version?: number
        }
        Relationships: []
      }
      measurement_report_snapshots: {
        Row: {
          calculation_version: string
          frozen_at: string | null
          generated_at: string
          governance_release_status_id: string | null
          id: string
          program_id: string
          protocol_version_id: string
          released_at: string | null
          report_payload: Json
          status: string
        }
        Insert: {
          calculation_version: string
          frozen_at?: string | null
          generated_at?: string
          governance_release_status_id?: string | null
          id?: string
          program_id: string
          protocol_version_id: string
          released_at?: string | null
          report_payload: Json
          status?: string
        }
        Update: {
          calculation_version?: string
          frozen_at?: string | null
          generated_at?: string
          governance_release_status_id?: string | null
          id?: string
          program_id?: string
          protocol_version_id?: string
          released_at?: string | null
          report_payload?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "measurement_report_snapshots_governance_release_status_id__fkey"
            columns: ["governance_release_status_id", "program_id", "protocol_version_id"]
            referencedRelation: "governance_release_statuses"
            referencedColumns: ["id", "program_id", "protocol_version_id"]
          },
          {
            foreignKeyName: "measurement_report_snapshots_program_id_fkey"
            columns: ["program_id"]
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_report_snapshots_protocol_version_id_program_i_fkey"
            columns: ["protocol_version_id", "program_id"]
            referencedRelation: "assessment_protocol_versions"
            referencedColumns: ["id", "program_id"]
          },
        ]
      }
      metric_consents: {
        Row: {
          expires_at: string
          granted_at: string
          grantee_profile_id: string
          grantee_role: string
          id: string
          metric_record_id: string
          owner_profile_id: string
          purpose: string
          revocation_reason: string | null
          revoked_at: string | null
        }
        Insert: {
          expires_at: string
          granted_at?: string
          grantee_profile_id: string
          grantee_role: string
          id?: string
          metric_record_id: string
          owner_profile_id: string
          purpose: string
          revocation_reason?: string | null
          revoked_at?: string | null
        }
        Update: {
          expires_at?: string
          granted_at?: string
          grantee_profile_id?: string
          grantee_role?: string
          id?: string
          metric_record_id?: string
          owner_profile_id?: string
          purpose?: string
          revocation_reason?: string | null
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "metric_consents_grantee_profile_id_fkey"
            columns: ["grantee_profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_consents_metric_record_id_fkey"
            columns: ["metric_record_id"]
            referencedRelation: "metric_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_consents_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_records: {
        Row: {
          ai_request_id: string | null
          created_at: string
          draft_index: number | null
          extraction_confidence: number | null
          id: string
          metric_type: string
          numeric_value: number
          observed_at: string | null
          owner_profile_id: string
          program_id: string
          sensitivity: string
          source: string
          submission_id: string | null
          unit: string
          updated_at: string
          upload_id: string | null
          verification_status: string
        }
        Insert: {
          ai_request_id?: string | null
          created_at?: string
          draft_index?: number | null
          extraction_confidence?: number | null
          id?: string
          metric_type: string
          numeric_value: number
          observed_at?: string | null
          owner_profile_id: string
          program_id: string
          sensitivity?: string
          source: string
          submission_id?: string | null
          unit: string
          updated_at?: string
          upload_id?: string | null
          verification_status?: string
        }
        Update: {
          ai_request_id?: string | null
          created_at?: string
          draft_index?: number | null
          extraction_confidence?: number | null
          id?: string
          metric_type?: string
          numeric_value?: number
          observed_at?: string | null
          owner_profile_id?: string
          program_id?: string
          sensitivity?: string
          source?: string
          submission_id?: string | null
          unit?: string
          updated_at?: string
          upload_id?: string | null
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "metric_records_ai_request_fk"
            columns: ["ai_request_id"]
            referencedRelation: "ai_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_records_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_records_program_id_fkey"
            columns: ["program_id"]
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_records_submission_id_fkey"
            columns: ["submission_id"]
            referencedRelation: "homework_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_records_upload_id_fkey"
            columns: ["upload_id"]
            referencedRelation: "data_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          attempt_count: number
          available_at: string
          channel: string
          created_at: string
          id: string
          idempotency_key: string
          last_error_code: string | null
          locked_at: string | null
          notification_id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          attempt_count?: number
          available_at?: string
          channel: string
          created_at?: string
          id?: string
          idempotency_key: string
          last_error_code?: string | null
          locked_at?: string | null
          notification_id: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          attempt_count?: number
          available_at?: string
          channel?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          last_error_code?: string | null
          locked_at?: string | null
          notification_id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_notification_id_fkey"
            columns: ["notification_id"]
            referencedRelation: "notification_records"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_records: {
        Row: {
          body: string
          category: string
          contains_sensitive_data: boolean
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          program_id: string | null
          read_at: string | null
          recipient_profile_id: string
          title: string
        }
        Insert: {
          body: string
          category: string
          contains_sensitive_data?: boolean
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          program_id?: string | null
          read_at?: string | null
          recipient_profile_id: string
          title: string
        }
        Update: {
          body?: string
          category?: string
          contains_sensitive_data?: boolean
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          program_id?: string | null
          read_at?: string | null
          recipient_profile_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_records_program_id_fkey"
            columns: ["program_id"]
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_records_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          organization_id: string
          profile_id: string
          role: string
          starts_at: string
          status: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          organization_id: string
          profile_id: string
          role: string
          starts_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          organization_id?: string
          profile_id?: string
          role?: string
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_memberships_profile_id_fkey"
            columns: ["profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          lifecycle_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          lifecycle_status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          lifecycle_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      program_attrition_events: {
        Row: {
          created_at: string
          effective_at: string
          enrollment_id: string
          event_kind: string
          id: string
          program_id: string
          reason_code: string
        }
        Insert: {
          created_at?: string
          effective_at: string
          enrollment_id: string
          event_kind: string
          id?: string
          program_id: string
          reason_code: string
        }
        Update: {
          created_at?: string
          effective_at?: string
          enrollment_id?: string
          event_kind?: string
          id?: string
          program_id?: string
          reason_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_attrition_events_enrollment_id_program_id_fkey"
            columns: ["enrollment_id", "program_id"]
            referencedRelation: "program_enrollments"
            referencedColumns: ["id", "program_id"]
          },
          {
            foreignKeyName: "program_attrition_events_program_id_fkey"
            columns: ["program_id"]
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_enrollments: {
        Row: {
          active_from: string | null
          active_until: string | null
          completed_at: string | null
          created_at: string
          enrolled_on: string
          id: string
          invitation_id: string | null
          lifecycle_status: string
          profile_id: string
          program_id: string
          program_membership_id: string
          withdrawn_at: string | null
        }
        Insert: {
          active_from?: string | null
          active_until?: string | null
          completed_at?: string | null
          created_at?: string
          enrolled_on: string
          id?: string
          invitation_id?: string | null
          lifecycle_status?: string
          profile_id: string
          program_id: string
          program_membership_id: string
          withdrawn_at?: string | null
        }
        Update: {
          active_from?: string | null
          active_until?: string | null
          completed_at?: string | null
          created_at?: string
          enrolled_on?: string
          id?: string
          invitation_id?: string | null
          lifecycle_status?: string
          profile_id?: string
          program_id?: string
          program_membership_id?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_enrollments_invitation_id_fkey"
            columns: ["invitation_id"]
            referencedRelation: "program_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_enrollments_profile_id_fkey"
            columns: ["profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_enrollments_program_id_fkey"
            columns: ["program_id"]
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_enrollments_program_membership_id_program_id_profi_fkey"
            columns: ["program_membership_id", "program_id", "profile_id"]
            referencedRelation: "program_memberships"
            referencedColumns: ["id", "program_id", "profile_id"]
          },
        ]
      }
      program_invitations: {
        Row: {
          accepted_at: string | null
          expires_at: string
          id: string
          invited_at: string
          invitee_email_hash: string
          invitee_profile_id: string | null
          program_id: string
          role: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          expires_at: string
          id?: string
          invited_at?: string
          invitee_email_hash: string
          invitee_profile_id?: string | null
          program_id: string
          role: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          expires_at?: string
          id?: string
          invited_at?: string
          invitee_email_hash?: string
          invitee_profile_id?: string | null
          program_id?: string
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_invitations_invitee_profile_id_fkey"
            columns: ["invitee_profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_invitations_program_id_fkey"
            columns: ["program_id"]
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_memberships: {
        Row: {
          ended_at: string | null
          id: string
          joined_at: string
          profile_id: string
          program_id: string
          role: string
          status: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          joined_at?: string
          profile_id: string
          program_id: string
          role: string
          status?: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          joined_at?: string
          profile_id?: string
          program_id?: string
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_memberships_profile_id_fkey"
            columns: ["profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_memberships_program_id_fkey"
            columns: ["program_id"]
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_sessions: {
        Row: {
          id: string
          program_id: string
          scheduled_at: string
          session_kind: string
          session_number: number
          title: string
        }
        Insert: {
          id?: string
          program_id: string
          scheduled_at: string
          session_kind: string
          session_number: number
          title: string
        }
        Update: {
          id?: string
          program_id?: string
          scheduled_at?: string
          session_kind?: string
          session_number?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_sessions_program_id_fkey"
            columns: ["program_id"]
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          created_at: string
          created_by: string
          ends_on: string
          id: string
          organization_id: string
          starts_on: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          ends_on: string
          id?: string
          organization_id: string
          starts_on: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          ends_on?: string
          id?: string
          organization_id?: string
          starts_on?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_secret: string
          created_at: string
          endpoint: string
          endpoint_hash: string | null
          expires_at: string | null
          id: string
          last_seen_at: string
          p256dh: string
          profile_id: string
        }
        Insert: {
          auth_secret: string
          created_at?: string
          endpoint: string
          endpoint_hash?: string | null
          expires_at?: string | null
          id?: string
          last_seen_at?: string
          p256dh: string
          profile_id: string
        }
        Update: {
          auth_secret?: string
          created_at?: string
          endpoint?: string
          endpoint_hash?: string | null
          expires_at?: string | null
          id?: string
          last_seen_at?: string
          p256dh?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      report_aggregate_cells: {
        Row: {
          column_key: string
          id: string
          numeric_value: number | null
          participant_count: number
          row_key: string
          snapshot_id: string
          suppressed: boolean
          suppression_reason: string | null
        }
        Insert: {
          column_key: string
          id?: string
          numeric_value?: number | null
          participant_count: number
          row_key: string
          snapshot_id: string
          suppressed?: boolean
          suppression_reason?: string | null
        }
        Update: {
          column_key?: string
          id?: string
          numeric_value?: number | null
          participant_count?: number
          row_key?: string
          snapshot_id?: string
          suppressed?: boolean
          suppression_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_aggregate_cells_snapshot_id_fkey"
            columns: ["snapshot_id"]
            referencedRelation: "measurement_report_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      resting_heart_rate_readings: {
        Row: {
          accepted_at: string | null
          bpm: number
          device_family: string
          enrollment_id: string
          id: string
          local_date: string
          local_time: string
          program_id: string
          protocol_version_id: string
          recorded_at: string
          source_family: string
          status: string
          timezone: string
        }
        Insert: {
          accepted_at?: string | null
          bpm: number
          device_family: string
          enrollment_id: string
          id?: string
          local_date: string
          local_time: string
          program_id: string
          protocol_version_id: string
          recorded_at?: string
          source_family: string
          status?: string
          timezone: string
        }
        Update: {
          accepted_at?: string | null
          bpm?: number
          device_family?: string
          enrollment_id?: string
          id?: string
          local_date?: string
          local_time?: string
          program_id?: string
          protocol_version_id?: string
          recorded_at?: string
          source_family?: string
          status?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "resting_heart_rate_readings_enrollment_id_program_id_fkey"
            columns: ["enrollment_id", "program_id"]
            referencedRelation: "program_enrollments"
            referencedColumns: ["id", "program_id"]
          },
          {
            foreignKeyName: "resting_heart_rate_readings_program_id_fkey"
            columns: ["program_id"]
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resting_heart_rate_readings_protocol_version_id_program_id_fkey"
            columns: ["protocol_version_id", "program_id"]
            referencedRelation: "assessment_protocol_versions"
            referencedColumns: ["id", "program_id"]
          },
        ]
      }
      session_adherence_evidence: {
        Row: {
          accepted_at: string | null
          created_at: string
          enrollment_id: string
          evidence_kind: string
          id: string
          linked_record_id: string
          prescription_id: string
          program_id: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          enrollment_id: string
          evidence_kind: string
          id?: string
          linked_record_id: string
          prescription_id: string
          program_id: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          enrollment_id?: string
          evidence_kind?: string
          id?: string
          linked_record_id?: string
          prescription_id?: string
          program_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_adherence_evidence_prescription_id_fkey"
            columns: ["prescription_id"]
            referencedRelation: "training_prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_adherence_evidence_program_id_fkey"
            columns: ["program_id"]
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_configs: {
        Row: {
          brand_key: string
          created_at: string
          organization_id: string
          program_config_key: string
          timezone: string
        }
        Insert: {
          brand_key: string
          created_at?: string
          organization_id: string
          program_config_key: string
          timezone?: string
        }
        Update: {
          brand_key?: string
          created_at?: string
          organization_id?: string
          program_config_key?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_configs_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      time_trial_decisions: {
        Row: {
          decided_at: string
          decided_by: string
          initial_session_number: number
          program_id: string
          protocol: string
        }
        Insert: {
          decided_at?: string
          decided_by: string
          initial_session_number: number
          program_id: string
          protocol: string
        }
        Update: {
          decided_at?: string
          decided_by?: string
          initial_session_number?: number
          program_id?: string
          protocol?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_trial_decisions_decided_by_fkey"
            columns: ["decided_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_trial_decisions_program_id_fkey"
            columns: ["program_id"]
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      training_prescriptions: {
        Row: {
          assigned_at: string
          assigned_while_active: boolean
          created_at: string
          enrollment_id: string
          id: string
          program_id: string
          session_id: string
          status: string
        }
        Insert: {
          assigned_at: string
          assigned_while_active?: boolean
          created_at?: string
          enrollment_id: string
          id?: string
          program_id: string
          session_id: string
          status?: string
        }
        Update: {
          assigned_at?: string
          assigned_while_active?: boolean
          created_at?: string
          enrollment_id?: string
          id?: string
          program_id?: string
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_prescriptions_enrollment_id_program_id_fkey"
            columns: ["enrollment_id", "program_id"]
            referencedRelation: "program_enrollments"
            referencedColumns: ["id", "program_id"]
          },
          {
            foreignKeyName: "training_prescriptions_program_id_fkey"
            columns: ["program_id"]
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_prescriptions_session_id_program_id_fkey"
            columns: ["session_id", "program_id"]
            referencedRelation: "program_sessions"
            referencedColumns: ["id", "program_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      review_feedback: {
        Args: {
          review_note?: string
          target_decision: string
          target_feedback: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
