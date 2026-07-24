export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      abuse_reports: {
        Row: {
          created_at: string
          description: string | null
          id: string
          report_type: string
          reporter_user_id: string | null
          room_id: string | null
          status: string
          target_user_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          report_type: string
          reporter_user_id?: string | null
          room_id?: string | null
          status?: string
          target_user_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          report_type?: string
          reporter_user_id?: string | null
          room_id?: string | null
          status?: string
          target_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      admin_audit_logs: {
        Row: {
          action_type: string
          actor_admin_user_id: string | null
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          action_type: string
          actor_admin_user_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          actor_admin_user_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_entity_notes: {
        Row: {
          admin_user_id: string | null
          body: string
          created_at: string
          id: string
          metadata: Json
          pinned: boolean
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          admin_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          metadata?: Json
          pinned?: boolean
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          admin_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          metadata?: Json
          pinned?: boolean
          target_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_permission_presets: {
        Row: {
          created_at: string
          description: string
          display_name: string
          is_system: boolean
          permissions: string[]
          role_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          display_name: string
          is_system?: boolean
          permissions?: string[]
          role_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          display_name?: string
          is_system?: boolean
          permissions?: string[]
          role_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_role_assignments: {
        Row: {
          created_at: string
          granted_at: string
          granted_by_admin_user_id: string | null
          id: string
          metadata: Json
          note: string | null
          permissions: string[]
          revoked_at: string | null
          revoked_by_admin_user_id: string | null
          role_key: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_at?: string
          granted_by_admin_user_id?: string | null
          id?: string
          metadata?: Json
          note?: string | null
          permissions?: string[]
          revoked_at?: string | null
          revoked_by_admin_user_id?: string | null
          role_key?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_at?: string
          granted_by_admin_user_id?: string | null
          id?: string
          metadata?: Json
          note?: string | null
          permissions?: string[]
          revoked_at?: string | null
          revoked_by_admin_user_id?: string | null
          role_key?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_room_host_sessions: {
        Row: {
          active_seconds: number
          ai_mode: string
          created_at: string
          ended_at: string | null
          host_credit_budget: number
          host_credit_spent: number
          host_credit_used: number
          id: string
          metadata: Json
          mode: string
          payer_user_id: string | null
          provider: string | null
          provider_session_id: string | null
          room_id: string
          sponsor_user_id: string
          started_at: string
          status: string
          stop_reason: string | null
          summary_json: Json
        }
        Insert: {
          active_seconds?: number
          ai_mode: string
          created_at?: string
          ended_at?: string | null
          host_credit_budget?: number
          host_credit_spent?: number
          host_credit_used?: number
          id?: string
          metadata?: Json
          mode: string
          payer_user_id?: string | null
          provider?: string | null
          provider_session_id?: string | null
          room_id: string
          sponsor_user_id: string
          started_at?: string
          status?: string
          stop_reason?: string | null
          summary_json?: Json
        }
        Update: {
          active_seconds?: number
          ai_mode?: string
          created_at?: string
          ended_at?: string | null
          host_credit_budget?: number
          host_credit_spent?: number
          host_credit_used?: number
          id?: string
          metadata?: Json
          mode?: string
          payer_user_id?: string | null
          provider?: string | null
          provider_session_id?: string | null
          room_id?: string
          sponsor_user_id?: string
          started_at?: string
          status?: string
          stop_reason?: string | null
          summary_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_room_host_sessions_room_fk"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_room_host_sessions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_events: {
        Row: {
          ai_mode: string
          ai_session_id: string | null
          benefited_user_ids: string[]
          created_at: string
          estimated_cost_usd: number | null
          host_credit_used: number
          id: string
          input_tokens: number | null
          metadata: Json
          mode: string
          model: string | null
          output_tokens: number | null
          payer_user_id: string | null
          personal_ai_active_seconds: number
          provider: string | null
          provider_cost_estimate_twd: number | null
          provider_error_code: string | null
          room_id: string | null
          session_id: string | null
          shared_host_active_seconds: number
          stop_reason: string | null
          user_id: string
        }
        Insert: {
          ai_mode: string
          ai_session_id?: string | null
          benefited_user_ids?: string[]
          created_at?: string
          estimated_cost_usd?: number | null
          host_credit_used?: number
          id?: string
          input_tokens?: number | null
          metadata?: Json
          mode: string
          model?: string | null
          output_tokens?: number | null
          payer_user_id?: string | null
          personal_ai_active_seconds?: number
          provider?: string | null
          provider_cost_estimate_twd?: number | null
          provider_error_code?: string | null
          room_id?: string | null
          session_id?: string | null
          shared_host_active_seconds?: number
          stop_reason?: string | null
          user_id: string
        }
        Update: {
          ai_mode?: string
          ai_session_id?: string | null
          benefited_user_ids?: string[]
          created_at?: string
          estimated_cost_usd?: number | null
          host_credit_used?: number
          id?: string
          input_tokens?: number | null
          metadata?: Json
          mode?: string
          model?: string | null
          output_tokens?: number | null
          payer_user_id?: string | null
          personal_ai_active_seconds?: number
          provider?: string | null
          provider_cost_estimate_twd?: number | null
          provider_error_code?: string | null
          room_id?: string | null
          session_id?: string | null
          shared_host_active_seconds?: number
          stop_reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_room_fk"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_events_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_events_session_fk"
            columns: ["ai_session_id"]
            isOneToOne: false
            referencedRelation: "ai_room_host_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_room_host_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_user_mode_preferences: {
        Row: {
          created_at: string
          default_global_persona: string
          default_presence_mode: Database["public"]["Enums"]["presence_mode"]
          default_room_persona: string
          prefers_shared_host_first: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_global_persona?: string
          default_presence_mode?: Database["public"]["Enums"]["presence_mode"]
          default_room_persona?: string
          prefers_shared_host_first?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_global_persona?: string
          default_presence_mode?: Database["public"]["Enums"]["presence_mode"]
          default_room_persona?: string
          prefers_shared_host_first?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      appeal_events: {
        Row: {
          actor_role: string
          actor_user_id: string | null
          appeal_id: string
          created_at: string
          event_type: string
          from_status: string | null
          id: string
          metadata: Json
          to_status: string | null
        }
        Insert: {
          actor_role?: string
          actor_user_id?: string | null
          appeal_id: string
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: string
          metadata?: Json
          to_status?: string | null
        }
        Update: {
          actor_role?: string
          actor_user_id?: string | null
          appeal_id?: string
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appeal_events_appeal_id_fkey"
            columns: ["appeal_id"]
            isOneToOne: false
            referencedRelation: "appeals"
            referencedColumns: ["id"]
          },
        ]
      }
      appeal_messages: {
        Row: {
          appeal_id: string
          body: string
          created_at: string
          id: string
          metadata: Json
          sender_role: string
          sender_user_id: string | null
        }
        Insert: {
          appeal_id: string
          body: string
          created_at?: string
          id?: string
          metadata?: Json
          sender_role?: string
          sender_user_id?: string | null
        }
        Update: {
          appeal_id?: string
          body?: string
          created_at?: string
          id?: string
          metadata?: Json
          sender_role?: string
          sender_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appeal_messages_appeal_id_fkey"
            columns: ["appeal_id"]
            isOneToOne: false
            referencedRelation: "appeals"
            referencedColumns: ["id"]
          },
        ]
      }
      appeals: {
        Row: {
          admin_response: string | null
          closed_at: string | null
          created_at: string
          decision: string | null
          decision_reason: string | null
          id: string
          idempotency_key: string | null
          last_admin_message_at: string | null
          last_user_message_at: string | null
          message: string
          metadata: Json
          moderation_action_id: string | null
          moderation_case_id: string | null
          reason_code: string
          requested_outcome: string | null
          resolution_action_id: string | null
          resolved_at: string | null
          resolved_by_admin_user_id: string | null
          review_started_at: string | null
          source: string
          status: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          admin_response?: string | null
          closed_at?: string | null
          created_at?: string
          decision?: string | null
          decision_reason?: string | null
          id?: string
          idempotency_key?: string | null
          last_admin_message_at?: string | null
          last_user_message_at?: string | null
          message: string
          metadata?: Json
          moderation_action_id?: string | null
          moderation_case_id?: string | null
          reason_code?: string
          requested_outcome?: string | null
          resolution_action_id?: string | null
          resolved_at?: string | null
          resolved_by_admin_user_id?: string | null
          review_started_at?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          admin_response?: string | null
          closed_at?: string | null
          created_at?: string
          decision?: string | null
          decision_reason?: string | null
          id?: string
          idempotency_key?: string | null
          last_admin_message_at?: string | null
          last_user_message_at?: string | null
          message?: string
          metadata?: Json
          moderation_action_id?: string | null
          moderation_case_id?: string | null
          reason_code?: string
          requested_outcome?: string | null
          resolution_action_id?: string | null
          resolved_at?: string | null
          resolved_by_admin_user_id?: string | null
          review_started_at?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "appeals_moderation_action_id_fkey"
            columns: ["moderation_action_id"]
            isOneToOne: false
            referencedRelation: "moderation_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appeals_moderation_case_id_fkey"
            columns: ["moderation_case_id"]
            isOneToOne: false
            referencedRelation: "moderation_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appeals_resolution_action_id_fkey"
            columns: ["resolution_action_id"]
            isOneToOne: false
            referencedRelation: "moderation_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_sms_attempts: {
        Row: {
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          metadata: Json
          otp_flow: string
          phone: string
          provider: string
          provider_message_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json
          otp_flow?: string
          phone: string
          provider: string
          provider_message_id?: string | null
          status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json
          otp_flow?: string
          phone?: string
          provider?: string
          provider_message_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      billing_automation_locks: {
        Row: {
          job_name: string
          locked_by: string | null
          locked_until: string
          updated_at: string
        }
        Insert: {
          job_name: string
          locked_by?: string | null
          locked_until: string
          updated_at?: string
        }
        Update: {
          job_name?: string
          locked_by?: string | null
          locked_until?: string
          updated_at?: string
        }
        Relationships: []
      }
      billing_automation_runs: {
        Row: {
          automation_build_tag: string | null
          build_tag: string | null
          created_at: string
          duration_ms: number | null
          error: string | null
          finished_at: string | null
          id: string
          job_name: string
          result: Json | null
          schedule: string | null
          started_at: string
          status: string
          trigger_source: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          automation_build_tag?: string | null
          build_tag?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          job_name?: string
          result?: Json | null
          schedule?: string | null
          started_at?: string
          status: string
          trigger_source?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          automation_build_tag?: string | null
          build_tag?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          job_name?: string
          result?: Json | null
          schedule?: string | null
          started_at?: string
          status?: string
          trigger_source?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      billing_ledger: {
        Row: {
          amount_twd: number
          buddy_booking_id: string | null
          created_at: string
          currency: string
          description: string | null
          direction: string
          id: string
          ledger_type: string
          metadata: Json
          occurred_at: string
          payment_order_id: string | null
          provider: string
          room_id: string | null
          user_id: string
        }
        Insert: {
          amount_twd?: number
          buddy_booking_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          direction: string
          id?: string
          ledger_type: string
          metadata?: Json
          occurred_at?: string
          payment_order_id?: string | null
          provider?: string
          room_id?: string | null
          user_id: string
        }
        Update: {
          amount_twd?: number
          buddy_booking_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          direction?: string
          id?: string
          ledger_type?: string
          metadata?: Json
          occurred_at?: string
          payment_order_id?: string | null
          provider?: string
          room_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_ledger_buddy_booking_id_fkey"
            columns: ["buddy_booking_id"]
            isOneToOne: false
            referencedRelation: "buddy_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_ledger_payment_order_id_fkey"
            columns: ["payment_order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_ledger_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      buddy_booking_events: {
        Row: {
          actor_user_id: string | null
          booking_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
        }
        Insert: {
          actor_user_id?: string | null
          booking_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          actor_user_id?: string | null
          booking_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "buddy_booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "buddy_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      buddy_booking_payment_applications: {
        Row: {
          amount_twd: number
          applied_at: string | null
          booking_id: string
          buyer_user_id: string
          created_at: string
          id: string
          metadata: Json
          payment_order_id: string
          provider_user_id: string
          reversed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_twd?: number
          applied_at?: string | null
          booking_id: string
          buyer_user_id: string
          created_at?: string
          id?: string
          metadata?: Json
          payment_order_id: string
          provider_user_id: string
          reversed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_twd?: number
          applied_at?: string | null
          booking_id?: string
          buyer_user_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          payment_order_id?: string
          provider_user_id?: string
          reversed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buddy_booking_payment_applications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "buddy_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_booking_payment_applications_payment_order_id_fkey"
            columns: ["payment_order_id"]
            isOneToOne: true
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      buddy_bookings: {
        Row: {
          accepted_at: string | null
          booking_status: string
          buyer_completed_at: string | null
          buyer_note: string | null
          buyer_user_id: string
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          dispute_status: string
          hours_booked: number
          id: string
          linked_room_id: string | null
          paid_at: string | null
          payment_due_at: string | null
          payment_failed_at: string | null
          payment_order_id: string | null
          payment_status: string
          provider_completed_at: string | null
          provider_note: string | null
          provider_user_id: string
          room_provision_claimed_at: string | null
          room_provision_error: string | null
          room_provision_status: string
          scheduled_end_at: string | null
          scheduled_start_at: string
          service_id: string
          settlement_id: string | null
          total_amount_twd: number
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          booking_status?: string
          buyer_completed_at?: string | null
          buyer_note?: string | null
          buyer_user_id: string
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          dispute_status?: string
          hours_booked: number
          id?: string
          linked_room_id?: string | null
          paid_at?: string | null
          payment_due_at?: string | null
          payment_failed_at?: string | null
          payment_order_id?: string | null
          payment_status?: string
          provider_completed_at?: string | null
          provider_note?: string | null
          provider_user_id: string
          room_provision_claimed_at?: string | null
          room_provision_error?: string | null
          room_provision_status?: string
          scheduled_end_at?: string | null
          scheduled_start_at: string
          service_id: string
          settlement_id?: string | null
          total_amount_twd: number
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          booking_status?: string
          buyer_completed_at?: string | null
          buyer_note?: string | null
          buyer_user_id?: string
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          dispute_status?: string
          hours_booked?: number
          id?: string
          linked_room_id?: string | null
          paid_at?: string | null
          payment_due_at?: string | null
          payment_failed_at?: string | null
          payment_order_id?: string | null
          payment_status?: string
          provider_completed_at?: string | null
          provider_note?: string | null
          provider_user_id?: string
          room_provision_claimed_at?: string | null
          room_provision_error?: string | null
          room_provision_status?: string
          scheduled_end_at?: string | null
          scheduled_start_at?: string
          service_id?: string
          settlement_id?: string | null
          total_amount_twd?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buddy_bookings_linked_room_id_fkey"
            columns: ["linked_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_bookings_payment_order_id_fkey"
            columns: ["payment_order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "buddy_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_bookings_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "buddy_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      buddy_disputes: {
        Row: {
          admin_note: string | null
          admin_user_id: string | null
          booking_id: string | null
          counterparty_user_id: string | null
          created_at: string
          description: string
          dispute_status: string
          id: string
          metadata: Json
          opened_by_user_id: string | null
          reason_category: string
          resolved_at: string | null
          service_id: string | null
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          admin_user_id?: string | null
          booking_id?: string | null
          counterparty_user_id?: string | null
          created_at?: string
          description: string
          dispute_status?: string
          id?: string
          metadata?: Json
          opened_by_user_id?: string | null
          reason_category?: string
          resolved_at?: string | null
          service_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          admin_user_id?: string | null
          booking_id?: string | null
          counterparty_user_id?: string | null
          created_at?: string
          description?: string
          dispute_status?: string
          id?: string
          metadata?: Json
          opened_by_user_id?: string | null
          reason_category?: string
          resolved_at?: string | null
          service_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buddy_disputes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "buddy_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_disputes_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "buddy_services"
            referencedColumns: ["id"]
          },
        ]
      }
      buddy_payout_accounts: {
        Row: {
          account_holder_name: string
          account_last5: string
          bank_code: string
          created_at: string
          id: string
          metadata: Json
          payout_method: string
          provider_user_id: string
          reviewer_note: string | null
          secure_provider_reference: string | null
          status: string
          updated_at: string
          verified_at: string | null
          verified_by_admin_user_id: string | null
        }
        Insert: {
          account_holder_name: string
          account_last5: string
          bank_code: string
          created_at?: string
          id?: string
          metadata?: Json
          payout_method?: string
          provider_user_id: string
          reviewer_note?: string | null
          secure_provider_reference?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by_admin_user_id?: string | null
        }
        Update: {
          account_holder_name?: string
          account_last5?: string
          bank_code?: string
          created_at?: string
          id?: string
          metadata?: Json
          payout_method?: string
          provider_user_id?: string
          reviewer_note?: string | null
          secure_provider_reference?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by_admin_user_id?: string | null
        }
        Relationships: []
      }
      buddy_payout_batches: {
        Row: {
          approved_at: string
          completed_at: string | null
          created_at: string
          created_by_admin_user_id: string | null
          currency: string
          error: string | null
          id: string
          metadata: Json
          note: string | null
          payout_account_id: string
          processed_by_admin_user_id: string | null
          processing_at: string | null
          provider_reference: string | null
          provider_user_id: string
          status: string
          total_amount_twd: number
          total_items: number
          updated_at: string
        }
        Insert: {
          approved_at?: string
          completed_at?: string | null
          created_at?: string
          created_by_admin_user_id?: string | null
          currency?: string
          error?: string | null
          id?: string
          metadata?: Json
          note?: string | null
          payout_account_id: string
          processed_by_admin_user_id?: string | null
          processing_at?: string | null
          provider_reference?: string | null
          provider_user_id: string
          status?: string
          total_amount_twd?: number
          total_items?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string
          completed_at?: string | null
          created_at?: string
          created_by_admin_user_id?: string | null
          currency?: string
          error?: string | null
          id?: string
          metadata?: Json
          note?: string | null
          payout_account_id?: string
          processed_by_admin_user_id?: string | null
          processing_at?: string | null
          provider_reference?: string | null
          provider_user_id?: string
          status?: string
          total_amount_twd?: number
          total_items?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buddy_payout_batches_payout_account_id_fkey"
            columns: ["payout_account_id"]
            isOneToOne: false
            referencedRelation: "buddy_payout_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      buddy_payout_items: {
        Row: {
          amount_twd: number
          batch_id: string
          created_at: string
          error: string | null
          id: string
          metadata: Json
          payout_account_id: string
          processed_at: string | null
          provider_reference: string | null
          provider_user_id: string
          settlement_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_twd: number
          batch_id: string
          created_at?: string
          error?: string | null
          id?: string
          metadata?: Json
          payout_account_id: string
          processed_at?: string | null
          provider_reference?: string | null
          provider_user_id: string
          settlement_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_twd?: number
          batch_id?: string
          created_at?: string
          error?: string | null
          id?: string
          metadata?: Json
          payout_account_id?: string
          processed_at?: string | null
          provider_reference?: string | null
          provider_user_id?: string
          settlement_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buddy_payout_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "buddy_payout_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_payout_items_payout_account_id_fkey"
            columns: ["payout_account_id"]
            isOneToOne: false
            referencedRelation: "buddy_payout_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_payout_items_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: true
            referencedRelation: "buddy_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      buddy_provider_applications: {
        Row: {
          application_status: string
          created_at: string
          display_title: string | null
          experience_summary: string | null
          id: string
          identity_request_id: string | null
          metadata: Json
          reviewed_at: string | null
          reviewer_note: string | null
          reviewer_user_id: string | null
          service_boundaries: string | null
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          application_status?: string
          created_at?: string
          display_title?: string | null
          experience_summary?: string | null
          id?: string
          identity_request_id?: string | null
          metadata?: Json
          reviewed_at?: string | null
          reviewer_note?: string | null
          reviewer_user_id?: string | null
          service_boundaries?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          application_status?: string
          created_at?: string
          display_title?: string | null
          experience_summary?: string | null
          id?: string
          identity_request_id?: string | null
          metadata?: Json
          reviewed_at?: string | null
          reviewer_note?: string | null
          reviewer_user_id?: string | null
          service_boundaries?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buddy_provider_applications_identity_request_id_fkey"
            columns: ["identity_request_id"]
            isOneToOne: false
            referencedRelation: "identity_verification_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      buddy_reviews: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          reviewee_user_id: string
          reviewer_user_id: string
          service_id: string
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          reviewee_user_id: string
          reviewer_user_id: string
          service_id: string
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          reviewee_user_id?: string
          reviewer_user_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buddy_reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "buddy_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_reviews_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "buddy_services"
            referencedColumns: ["id"]
          },
        ]
      }
      buddy_service_slots: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          note: string | null
          provider_user_id: string
          service_id: string
          slot_status: string
          starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          note?: string | null
          provider_user_id: string
          service_id: string
          slot_status?: string
          starts_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          note?: string | null
          provider_user_id?: string
          service_id?: string
          slot_status?: string
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buddy_service_slots_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "buddy_services"
            referencedColumns: ["id"]
          },
        ]
      }
      buddy_services: {
        Row: {
          accepts_last_minute: boolean
          accepts_new_users: boolean
          availability_note: string | null
          buddy_category: string | null
          created_at: string
          delivery_mode: string | null
          description: string | null
          id: string
          interaction_style: string
          price_per_hour_twd: number
          provider_user_id: string
          room_category: string
          status: string
          summary: string
          tag_list: string[]
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          accepts_last_minute?: boolean
          accepts_new_users?: boolean
          availability_note?: string | null
          buddy_category?: string | null
          created_at?: string
          delivery_mode?: string | null
          description?: string | null
          id?: string
          interaction_style?: string
          price_per_hour_twd: number
          provider_user_id: string
          room_category: string
          status?: string
          summary: string
          tag_list?: string[]
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          accepts_last_minute?: boolean
          accepts_new_users?: boolean
          availability_note?: string | null
          buddy_category?: string | null
          created_at?: string
          delivery_mode?: string | null
          description?: string | null
          id?: string
          interaction_style?: string
          price_per_hour_twd?: number
          provider_user_id?: string
          room_category?: string
          status?: string
          summary?: string
          tag_list?: string[]
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      buddy_settlement_events: {
        Row: {
          actor_role: string
          actor_user_id: string | null
          amount_twd: number | null
          booking_id: string
          created_at: string
          event_type: string
          from_status: string | null
          id: string
          metadata: Json
          settlement_id: string | null
          to_status: string | null
        }
        Insert: {
          actor_role?: string
          actor_user_id?: string | null
          amount_twd?: number | null
          booking_id: string
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: string
          metadata?: Json
          settlement_id?: string | null
          to_status?: string | null
        }
        Update: {
          actor_role?: string
          actor_user_id?: string | null
          amount_twd?: number | null
          booking_id?: string
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          settlement_id?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buddy_settlement_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "buddy_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_settlement_events_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "buddy_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      buddy_settlements: {
        Row: {
          available_for_payout_at: string | null
          booking_id: string
          buyer_user_id: string
          created_at: string
          currency: string
          gross_amount_twd: number
          hold_reason: string | null
          id: string
          metadata: Json
          paid_out_at: string | null
          payment_order_id: string
          payout_account_id: string | null
          payout_batch_id: string | null
          platform_fee_bps: number
          platform_fee_twd: number
          provider_net_twd: number
          provider_user_id: string
          refund_amount_twd: number
          status: string
          updated_at: string
        }
        Insert: {
          available_for_payout_at?: string | null
          booking_id: string
          buyer_user_id: string
          created_at?: string
          currency?: string
          gross_amount_twd?: number
          hold_reason?: string | null
          id?: string
          metadata?: Json
          paid_out_at?: string | null
          payment_order_id: string
          payout_account_id?: string | null
          payout_batch_id?: string | null
          platform_fee_bps?: number
          platform_fee_twd?: number
          provider_net_twd?: number
          provider_user_id: string
          refund_amount_twd?: number
          status?: string
          updated_at?: string
        }
        Update: {
          available_for_payout_at?: string | null
          booking_id?: string
          buyer_user_id?: string
          created_at?: string
          currency?: string
          gross_amount_twd?: number
          hold_reason?: string | null
          id?: string
          metadata?: Json
          paid_out_at?: string | null
          payment_order_id?: string
          payout_account_id?: string | null
          payout_batch_id?: string | null
          platform_fee_bps?: number
          platform_fee_twd?: number
          provider_net_twd?: number
          provider_user_id?: string
          refund_amount_twd?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buddy_settlements_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "buddy_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_settlements_payment_order_id_fkey"
            columns: ["payment_order_id"]
            isOneToOne: true
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_settlements_payout_account_id_fkey"
            columns: ["payout_account_id"]
            isOneToOne: false
            referencedRelation: "buddy_payout_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_settlements_payout_batch_id_fkey"
            columns: ["payout_batch_id"]
            isOneToOne: false
            referencedRelation: "buddy_payout_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      cowork_identity_monthly_usage: {
        Row: {
          created_at: string
          credits_used: number
          identity_key: string
          last_user_id: string | null
          month_start: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits_used?: number
          identity_key: string
          last_user_id?: string | null
          month_start: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits_used?: number
          identity_key?: string
          last_user_id?: string | null
          month_start?: string
          updated_at?: string
        }
        Relationships: []
      }
      cowork_monthly_usage: {
        Row: {
          credits_used: number
          month_start: string
          updated_at: string
          user_id: string
        }
        Insert: {
          credits_used?: number
          month_start: string
          updated_at?: string
          user_id: string
        }
        Update: {
          credits_used?: number
          month_start?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ecpay_invoice_tasks: {
        Row: {
          action_type: string
          attempt_count: number
          created_at: string
          id: string
          invoice_event_id: string | null
          last_error: string | null
          next_attempt_at: string
          payment_order_id: string | null
          processed_at: string | null
          provider_invoice_no: string | null
          provider_payload: Json
          provider_random_number: string | null
          provider_task_id: string | null
          refund_request_id: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          action_type?: string
          attempt_count?: number
          created_at?: string
          id?: string
          invoice_event_id?: string | null
          last_error?: string | null
          next_attempt_at?: string
          payment_order_id?: string | null
          processed_at?: string | null
          provider_invoice_no?: string | null
          provider_payload?: Json
          provider_random_number?: string | null
          provider_task_id?: string | null
          refund_request_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          attempt_count?: number
          created_at?: string
          id?: string
          invoice_event_id?: string | null
          last_error?: string | null
          next_attempt_at?: string
          payment_order_id?: string | null
          processed_at?: string | null
          provider_invoice_no?: string | null
          provider_payload?: Json
          provider_random_number?: string | null
          provider_task_id?: string | null
          refund_request_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ecpay_invoice_tasks_invoice_event_id_fkey"
            columns: ["invoice_event_id"]
            isOneToOne: false
            referencedRelation: "invoice_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecpay_invoice_tasks_payment_order_id_fkey"
            columns: ["payment_order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      ecpay_refund_tasks: {
        Row: {
          attempt_count: number
          created_at: string
          id: string
          last_error: string | null
          next_attempt_at: string
          payment_order_id: string | null
          processed_at: string | null
          provider_payload: Json
          provider_refund_id: string | null
          provider_task_id: string | null
          refund_request_id: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          payment_order_id?: string | null
          processed_at?: string | null
          provider_payload?: Json
          provider_refund_id?: string | null
          provider_task_id?: string | null
          refund_request_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          payment_order_id?: string | null
          processed_at?: string | null
          provider_payload?: Json
          provider_refund_id?: string | null
          provider_task_id?: string | null
          refund_request_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ecpay_refund_tasks_payment_order_id_fkey"
            columns: ["payment_order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecpay_refund_tasks_refund_request_id_fkey"
            columns: ["refund_request_id"]
            isOneToOne: false
            referencedRelation: "refund_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ecpay_subscription_tasks: {
        Row: {
          action_type: string
          attempt_count: number
          created_at: string
          id: string
          last_error: string | null
          next_attempt_at: string
          processed_at: string | null
          provider_payload: Json
          provider_task_id: string | null
          status: string
          subscription_profile_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          processed_at?: string | null
          provider_payload?: Json
          provider_task_id?: string | null
          status?: string
          subscription_profile_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          processed_at?: string | null
          provider_payload?: Json
          provider_task_id?: string | null
          status?: string
          subscription_profile_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ecpay_subscription_tasks_subscription_profile_id_fkey"
            columns: ["subscription_profile_id"]
            isOneToOne: false
            referencedRelation: "subscription_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlement_events: {
        Row: {
          created_at: string
          entitlement_key: string
          event_type: string
          id: string
          metadata: Json
          payment_order_id: string | null
          plan_code: string | null
          quantity: number
          user_id: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          entitlement_key?: string
          event_type: string
          id?: string
          metadata?: Json
          payment_order_id?: string | null
          plan_code?: string | null
          quantity?: number
          user_id: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          entitlement_key?: string
          event_type?: string
          id?: string
          metadata?: Json
          payment_order_id?: string | null
          plan_code?: string | null
          quantity?: number
          user_id?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entitlement_events_payment_order_id_fkey"
            columns: ["payment_order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_requests: {
        Row: {
          addressee_user_id: string
          created_at: string
          id: string
          message: string | null
          pair_key: string | null
          requester_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addressee_user_id: string
          created_at?: string
          id?: string
          message?: string | null
          pair_key?: string | null
          requester_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_user_id?: string
          created_at?: string
          id?: string
          message?: string | null
          pair_key?: string | null
          requester_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          user_high: string
          user_low: string
        }
        Insert: {
          created_at?: string
          user_high: string
          user_low: string
        }
        Update: {
          created_at?: string
          user_high?: string
          user_low?: string
        }
        Relationships: []
      }
      identity_verification_requests: {
        Row: {
          birth_year: number | null
          created_at: string
          document_last4: string | null
          document_type: string | null
          id: string
          legal_name: string | null
          metadata: Json
          request_type: string
          review_status: string
          reviewed_at: string | null
          reviewer_note: string | null
          reviewer_user_id: string | null
          submitted_at: string
          updated_at: string
          user_id: string
          user_note: string | null
        }
        Insert: {
          birth_year?: number | null
          created_at?: string
          document_last4?: string | null
          document_type?: string | null
          id?: string
          legal_name?: string | null
          metadata?: Json
          request_type?: string
          review_status?: string
          reviewed_at?: string | null
          reviewer_note?: string | null
          reviewer_user_id?: string | null
          submitted_at?: string
          updated_at?: string
          user_id: string
          user_note?: string | null
        }
        Update: {
          birth_year?: number | null
          created_at?: string
          document_last4?: string | null
          document_type?: string | null
          id?: string
          legal_name?: string | null
          metadata?: Json
          request_type?: string
          review_status?: string
          reviewed_at?: string | null
          reviewer_note?: string | null
          reviewer_user_id?: string | null
          submitted_at?: string
          updated_at?: string
          user_id?: string
          user_note?: string | null
        }
        Relationships: []
      }
      invoice_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          invoice_number: string | null
          invoice_random_number: string | null
          issued_at: string | null
          metadata: Json
          payment_order_id: string | null
          provider: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          invoice_number?: string | null
          invoice_random_number?: string | null
          issued_at?: string | null
          metadata?: Json
          payment_order_id?: string | null
          provider?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          invoice_number?: string | null
          invoice_random_number?: string | null
          issued_at?: string | null
          metadata?: Json
          payment_order_id?: string | null
          provider?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_events_payment_order_id_fkey"
            columns: ["payment_order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action_type: string
          actor_admin_user_id: string | null
          case_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json
          reason: string | null
          starts_at: string | null
          target_user_id: string | null
        }
        Insert: {
          action_type: string
          actor_admin_user_id?: string | null
          case_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          reason?: string | null
          starts_at?: string | null
          target_user_id?: string | null
        }
        Update: {
          action_type?: string
          actor_admin_user_id?: string | null
          case_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          reason?: string | null
          starts_at?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "moderation_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_cases: {
        Row: {
          assigned_admin_user_id: string | null
          closed_at: string | null
          created_at: string
          id: string
          metadata: Json
          severity: string
          source_report_id: string | null
          status: string
          summary: string | null
          target_room_id: string | null
          target_type: string
          target_user_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_admin_user_id?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          severity?: string
          source_report_id?: string | null
          status?: string
          summary?: string | null
          target_room_id?: string | null
          target_type: string
          target_user_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_admin_user_id?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          severity?: string
          source_report_id?: string | null
          status?: string
          summary?: string | null
          target_room_id?: string | null
          target_type?: string
          target_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_cases_source_report_id_fkey"
            columns: ["source_report_id"]
            isOneToOne: false
            referencedRelation: "user_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_cases_target_room_id_fkey"
            columns: ["target_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_delivery_attempts: {
        Row: {
          attempted_at: string
          channel: string
          created_at: string
          error_message: string | null
          id: string
          notification_id: string | null
          provider: string | null
          provider_message_id: string | null
          provider_payload: Json
          status: string
        }
        Insert: {
          attempted_at?: string
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          notification_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          provider_payload?: Json
          status: string
        }
        Update: {
          attempted_at?: string
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          notification_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          provider_payload?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_delivery_attempts_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notification_outbox"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          attempt_count: number
          body: string
          channel: string
          created_at: string
          dedupe_key: string | null
          dismissed_at: string | null
          id: string
          last_error: string | null
          metadata: Json
          next_attempt_at: string
          priority: string
          provider: string | null
          provider_message_id: string | null
          provider_payload: Json
          read_at: string | null
          recipient: string | null
          sent_at: string | null
          status: string
          subject: string | null
          target_id: string | null
          target_type: string | null
          template_key: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempt_count?: number
          body: string
          channel: string
          created_at?: string
          dedupe_key?: string | null
          dismissed_at?: string | null
          id?: string
          last_error?: string | null
          metadata?: Json
          next_attempt_at?: string
          priority?: string
          provider?: string | null
          provider_message_id?: string | null
          provider_payload?: Json
          read_at?: string | null
          recipient?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          target_id?: string | null
          target_type?: string | null
          template_key: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempt_count?: number
          body?: string
          channel?: string
          created_at?: string
          dedupe_key?: string | null
          dismissed_at?: string | null
          id?: string
          last_error?: string | null
          metadata?: Json
          next_attempt_at?: string
          priority?: string
          provider?: string | null
          provider_message_id?: string | null
          provider_payload?: Json
          read_at?: string | null
          recipient?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          target_id?: string | null
          target_type?: string | null
          template_key?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          billing_updates: boolean
          created_at: string
          email_enabled: boolean
          in_app_enabled: boolean
          line_enabled: boolean
          locale: string
          marketing_updates: boolean
          metadata: Json
          quiet_hours_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          room_updates: boolean
          safety_updates: boolean
          sms_enabled: boolean
          support_updates: boolean
          telegram_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_updates?: boolean
          created_at?: string
          email_enabled?: boolean
          in_app_enabled?: boolean
          line_enabled?: boolean
          locale?: string
          marketing_updates?: boolean
          metadata?: Json
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          room_updates?: boolean
          safety_updates?: boolean
          sms_enabled?: boolean
          support_updates?: boolean
          telegram_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_updates?: boolean
          created_at?: string
          email_enabled?: boolean
          in_app_enabled?: boolean
          line_enabled?: boolean
          locale?: string
          marketing_updates?: boolean
          metadata?: Json
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          room_updates?: boolean
          safety_updates?: boolean
          sms_enabled?: boolean
          support_updates?: boolean
          telegram_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_templates: {
        Row: {
          body_template: string
          category: string
          channel: string
          created_at: string
          enabled: boolean
          id: string
          locale: string
          metadata: Json
          required_variables: string[]
          subject_template: string | null
          template_key: string
          updated_at: string
        }
        Insert: {
          body_template: string
          category?: string
          channel?: string
          created_at?: string
          enabled?: boolean
          id?: string
          locale?: string
          metadata?: Json
          required_variables?: string[]
          subject_template?: string | null
          template_key: string
          updated_at?: string
        }
        Update: {
          body_template?: string
          category?: string
          channel?: string
          created_at?: string
          enabled?: boolean
          id?: string
          locale?: string
          metadata?: Json
          required_variables?: string[]
          subject_template?: string | null
          template_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      ops_action_items: {
        Row: {
          assigned_admin_user_id: string | null
          category: string
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          metadata: Json
          resolution_note: string | null
          resolved_at: string | null
          resolved_by_admin_user_id: string | null
          severity: string
          source_id: string | null
          source_type: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_admin_user_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          metadata?: Json
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by_admin_user_id?: string | null
          severity?: string
          source_id?: string | null
          source_type: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_admin_user_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          metadata?: Json
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by_admin_user_id?: string | null
          severity?: string
          source_id?: string | null
          source_type?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          merchant_trade_no: string
          provider: string
          raw_payload: Json
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          merchant_trade_no: string
          provider?: string
          raw_payload?: Json
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          merchant_trade_no?: string
          provider?: string
          raw_payload?: Json
        }
        Relationships: []
      }
      payment_orders: {
        Row: {
          amount: number
          buddy_booking_id: string | null
          created_at: string
          currency: string
          id: string
          invoice_preference: Json | null
          item_name: string
          last_error: string | null
          merchant_trade_no: string
          paid_at: string | null
          plan_code: string
          provider: string
          provider_payload: Json
          provider_trade_no: string | null
          status: string
          trade_desc: string
          updated_at: string
          user_id: string
          vip_days: number
        }
        Insert: {
          amount: number
          buddy_booking_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          invoice_preference?: Json | null
          item_name: string
          last_error?: string | null
          merchant_trade_no: string
          paid_at?: string | null
          plan_code: string
          provider?: string
          provider_payload?: Json
          provider_trade_no?: string | null
          status?: string
          trade_desc: string
          updated_at?: string
          user_id: string
          vip_days?: number
        }
        Update: {
          amount?: number
          buddy_booking_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          invoice_preference?: Json | null
          item_name?: string
          last_error?: string | null
          merchant_trade_no?: string
          paid_at?: string | null
          plan_code?: string
          provider?: string
          provider_payload?: Json
          provider_trade_no?: string | null
          status?: string
          trade_desc?: string
          updated_at?: string
          user_id?: string
          vip_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_orders_buddy_booking_id_fkey"
            columns: ["buddy_booking_id"]
            isOneToOne: false
            referencedRelation: "buddy_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accepting_friend_requests: boolean
          accepting_schedule_invites: boolean
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          handle: string
          is_professional_buddy: boolean
          profile_visibility: string
          public_contact_note: string | null
          public_profile_enabled: boolean
          show_upcoming_schedule: boolean
          tags: string[]
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          accepting_friend_requests?: boolean
          accepting_schedule_invites?: boolean
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          handle: string
          is_professional_buddy?: boolean
          profile_visibility?: string
          public_contact_note?: string | null
          public_profile_enabled?: boolean
          show_upcoming_schedule?: boolean
          tags?: string[]
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          accepting_friend_requests?: boolean
          accepting_schedule_invites?: boolean
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          handle?: string
          is_professional_buddy?: boolean
          profile_visibility?: string
          public_contact_note?: string | null
          public_profile_enabled?: boolean
          show_upcoming_schedule?: boolean
          tags?: string[]
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      refund_events: {
        Row: {
          actor_role: string
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          refund_request_id: string
        }
        Insert: {
          actor_role?: string
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          refund_request_id: string
        }
        Update: {
          actor_role?: string
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          refund_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_events_refund_request_id_fkey"
            columns: ["refund_request_id"]
            isOneToOne: false
            referencedRelation: "refund_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_requests: {
        Row: {
          admin_note: string | null
          amount_twd: number | null
          created_at: string
          id: string
          metadata: Json
          payment_order_id: string | null
          provider: string
          provider_refund_id: string | null
          reason: string
          reason_category: string
          requested_at: string
          resolved_at: string | null
          reviewed_at: string | null
          reviewed_by_admin_user_id: string | null
          status: string
          support_ticket_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount_twd?: number | null
          created_at?: string
          id?: string
          metadata?: Json
          payment_order_id?: string | null
          provider?: string
          provider_refund_id?: string | null
          reason: string
          reason_category?: string
          requested_at?: string
          resolved_at?: string | null
          reviewed_at?: string | null
          reviewed_by_admin_user_id?: string | null
          status?: string
          support_ticket_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount_twd?: number | null
          created_at?: string
          id?: string
          metadata?: Json
          payment_order_id?: string | null
          provider?: string
          provider_refund_id?: string | null
          reason?: string
          reason_category?: string
          requested_at?: string
          resolved_at?: string | null
          reviewed_at?: string | null
          reviewed_by_admin_user_id?: string | null
          status?: string
          support_ticket_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_requests_payment_order_id_fkey"
            columns: ["payment_order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_requests_support_ticket_id_fkey"
            columns: ["support_ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      reliability_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          room_id: string | null
          severity: string
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          room_id?: string | null
          severity?: string
          source?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          room_id?: string | null
          severity?: string
          source?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reliability_events_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_access_sessions: {
        Row: {
          allowed_by_pair_vip_carry: boolean
          audio_only_seconds: number
          billable_participant_minutes: number
          billing_media_class: string
          billing_session_key: string
          charge_status: string
          charged_at: string | null
          commercial_plan_code: string | null
          connected_at: string | null
          connected_seconds: number
          cost_credits: number
          created_at: string
          daily_room_name: string
          disconnected_at: string | null
          duration_minutes: number
          entitlement_source: string
          estimated_provider_cost_usd: number
          id: string
          join_confirmed_at: string | null
          last_error: string | null
          last_presence_at: string | null
          last_token_issued_at: string | null
          provider_payload: Json
          reconciled_at: string | null
          reconciliation_source: string | null
          room_id: string
          screen_share_seconds: number
          status: string
          token_exp: string | null
          updated_at: string
          usage_status: string
          user_id: string
          visual_seconds: number
          wallet_visual_debited_seconds: number
          wallet_visual_overage_seconds: number
        }
        Insert: {
          allowed_by_pair_vip_carry?: boolean
          audio_only_seconds?: number
          billable_participant_minutes?: number
          billing_media_class?: string
          billing_session_key: string
          charge_status?: string
          charged_at?: string | null
          commercial_plan_code?: string | null
          connected_at?: string | null
          connected_seconds?: number
          cost_credits?: number
          created_at?: string
          daily_room_name: string
          disconnected_at?: string | null
          duration_minutes: number
          entitlement_source?: string
          estimated_provider_cost_usd?: number
          id?: string
          join_confirmed_at?: string | null
          last_error?: string | null
          last_presence_at?: string | null
          last_token_issued_at?: string | null
          provider_payload?: Json
          reconciled_at?: string | null
          reconciliation_source?: string | null
          room_id: string
          screen_share_seconds?: number
          status?: string
          token_exp?: string | null
          updated_at?: string
          usage_status?: string
          user_id: string
          visual_seconds?: number
          wallet_visual_debited_seconds?: number
          wallet_visual_overage_seconds?: number
        }
        Update: {
          allowed_by_pair_vip_carry?: boolean
          audio_only_seconds?: number
          billable_participant_minutes?: number
          billing_media_class?: string
          billing_session_key?: string
          charge_status?: string
          charged_at?: string | null
          commercial_plan_code?: string | null
          connected_at?: string | null
          connected_seconds?: number
          cost_credits?: number
          created_at?: string
          daily_room_name?: string
          disconnected_at?: string | null
          duration_minutes?: number
          entitlement_source?: string
          estimated_provider_cost_usd?: number
          id?: string
          join_confirmed_at?: string | null
          last_error?: string | null
          last_presence_at?: string | null
          last_token_issued_at?: string | null
          provider_payload?: Json
          reconciled_at?: string | null
          reconciliation_source?: string | null
          room_id?: string
          screen_share_seconds?: number
          status?: string
          token_exp?: string | null
          updated_at?: string
          usage_status?: string
          user_id?: string
          visual_seconds?: number
          wallet_visual_debited_seconds?: number
          wallet_visual_overage_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "room_access_sessions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_extension_confirmations: {
        Row: {
          access_session_id: string | null
          created_at: string
          current_scheduled_end_at: string | null
          decision: string
          extension_grant_id: string | null
          extension_window_key: string
          finalization_status: string | null
          finalized_at: string | null
          id: string
          is_rooms_entitled: boolean
          new_scheduled_end_at: string | null
          points_consumed: number
          requested_extension_minutes: number
          room_id: string
          sponsor_points_required: number
          sponsor_user_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_session_id?: string | null
          created_at?: string
          current_scheduled_end_at?: string | null
          decision: string
          extension_grant_id?: string | null
          extension_window_key: string
          finalization_status?: string | null
          finalized_at?: string | null
          id?: string
          is_rooms_entitled?: boolean
          new_scheduled_end_at?: string | null
          points_consumed?: number
          requested_extension_minutes?: number
          room_id: string
          sponsor_points_required?: number
          sponsor_user_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_session_id?: string | null
          created_at?: string
          current_scheduled_end_at?: string | null
          decision?: string
          extension_grant_id?: string | null
          extension_window_key?: string
          finalization_status?: string | null
          finalized_at?: string | null
          id?: string
          is_rooms_entitled?: boolean
          new_scheduled_end_at?: string | null
          points_consumed?: number
          requested_extension_minutes?: number
          room_id?: string
          sponsor_points_required?: number
          sponsor_user_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_extension_confirmations_access_session_id_fkey"
            columns: ["access_session_id"]
            isOneToOne: false
            referencedRelation: "room_access_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_extension_confirmations_extension_grant_id_fkey"
            columns: ["extension_grant_id"]
            isOneToOne: false
            referencedRelation: "room_extension_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_extension_confirmations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_extension_grants: {
        Row: {
          beneficiary_user_ids: string[]
          created_at: string
          extension_window_key: string
          id: string
          idempotency_key: string
          metadata: Json
          new_scheduled_end_at: string
          points_consumed: number
          previous_scheduled_end_at: string
          requested_extension_minutes: number
          room_id: string
          sponsor_user_id: string
          sponsor_wallet_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          beneficiary_user_ids?: string[]
          created_at?: string
          extension_window_key: string
          id?: string
          idempotency_key: string
          metadata?: Json
          new_scheduled_end_at: string
          points_consumed?: number
          previous_scheduled_end_at: string
          requested_extension_minutes?: number
          room_id: string
          sponsor_user_id: string
          sponsor_wallet_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          beneficiary_user_ids?: string[]
          created_at?: string
          extension_window_key?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          new_scheduled_end_at?: string
          points_consumed?: number
          previous_scheduled_end_at?: string
          requested_extension_minutes?: number
          room_id?: string
          sponsor_user_id?: string
          sponsor_wallet_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_extension_grants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_extension_grants_sponsor_wallet_id_fkey"
            columns: ["sponsor_wallet_id"]
            isOneToOne: false
            referencedRelation: "user_usage_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      room_lifecycle_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          reason: string | null
          room_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          reason?: string | null
          room_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          reason?: string | null
          room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_lifecycle_events_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_member_presence_state: {
        Row: {
          access_session_id: string | null
          audio_track_state: string
          billing_media_class: string
          brb_returned_at: string | null
          brb_started_at: string | null
          brb_until: string | null
          connected_at: string | null
          created_at: string
          daily_participant_state: string
          disconnected_at: string | null
          extension_confirmed_at: string | null
          last_event_type: string
          last_heartbeat_at: string | null
          last_hidden_at: string | null
          last_presence_at: string | null
          last_visible_at: string | null
          presence_mode: string
          presence_status: string
          room_id: string
          screen_track_state: string
          updated_at: string
          user_id: string
          video_track_state: string
        }
        Insert: {
          access_session_id?: string | null
          audio_track_state?: string
          billing_media_class?: string
          brb_returned_at?: string | null
          brb_started_at?: string | null
          brb_until?: string | null
          connected_at?: string | null
          created_at?: string
          daily_participant_state?: string
          disconnected_at?: string | null
          extension_confirmed_at?: string | null
          last_event_type?: string
          last_heartbeat_at?: string | null
          last_hidden_at?: string | null
          last_presence_at?: string | null
          last_visible_at?: string | null
          presence_mode?: string
          presence_status?: string
          room_id: string
          screen_track_state?: string
          updated_at?: string
          user_id: string
          video_track_state?: string
        }
        Update: {
          access_session_id?: string | null
          audio_track_state?: string
          billing_media_class?: string
          brb_returned_at?: string | null
          brb_started_at?: string | null
          brb_until?: string | null
          connected_at?: string | null
          created_at?: string
          daily_participant_state?: string
          disconnected_at?: string | null
          extension_confirmed_at?: string | null
          last_event_type?: string
          last_heartbeat_at?: string | null
          last_hidden_at?: string | null
          last_presence_at?: string | null
          last_visible_at?: string | null
          presence_mode?: string
          presence_status?: string
          room_id?: string
          screen_track_state?: string
          updated_at?: string
          user_id?: string
          video_track_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_member_presence_state_access_session_id_fkey"
            columns: ["access_session_id"]
            isOneToOne: false
            referencedRelation: "room_access_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_member_presence_state_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_members: {
        Row: {
          joined_at: string
          room_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          room_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_participant_summaries: {
        Row: {
          access_session_id: string | null
          actual_presence_seconds: number
          audio_only_seconds: number
          billing_media_class: string
          brb_count: number
          estimated_provider_cost_usd: number
          extension_confirm_count: number
          first_presence_at: string | null
          generated_at: string
          hidden_count: number
          joined_confirmed: boolean
          last_presence_at: string | null
          left_explicitly: boolean
          participant_minutes: number
          presence_mode: string
          reliability_event_count: number
          room_id: string
          screen_share_seconds: number
          summary_version: string
          updated_at: string
          user_id: string
          visual_seconds: number
        }
        Insert: {
          access_session_id?: string | null
          actual_presence_seconds?: number
          audio_only_seconds?: number
          billing_media_class?: string
          brb_count?: number
          estimated_provider_cost_usd?: number
          extension_confirm_count?: number
          first_presence_at?: string | null
          generated_at?: string
          hidden_count?: number
          joined_confirmed?: boolean
          last_presence_at?: string | null
          left_explicitly?: boolean
          participant_minutes?: number
          presence_mode?: string
          reliability_event_count?: number
          room_id: string
          screen_share_seconds?: number
          summary_version: string
          updated_at?: string
          user_id: string
          visual_seconds?: number
        }
        Update: {
          access_session_id?: string | null
          actual_presence_seconds?: number
          audio_only_seconds?: number
          billing_media_class?: string
          brb_count?: number
          estimated_provider_cost_usd?: number
          extension_confirm_count?: number
          first_presence_at?: string | null
          generated_at?: string
          hidden_count?: number
          joined_confirmed?: boolean
          last_presence_at?: string | null
          left_explicitly?: boolean
          participant_minutes?: number
          presence_mode?: string
          reliability_event_count?: number
          room_id?: string
          screen_share_seconds?: number
          summary_version?: string
          updated_at?: string
          user_id?: string
          visual_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "room_participant_summaries_access_session_id_fkey"
            columns: ["access_session_id"]
            isOneToOne: false
            referencedRelation: "room_access_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_participant_summaries_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_presence_events: {
        Row: {
          access_session_id: string | null
          audio_track_state: string | null
          billing_media_class: string | null
          brb_until: string | null
          created_at: string
          daily_participant_state: string | null
          event_type: string
          heartbeat_at: string | null
          id: string
          media_track_state: Json
          metadata: Json
          presence_mode: string
          room_id: string
          user_id: string
          video_track_state: string | null
          visible_state: string | null
        }
        Insert: {
          access_session_id?: string | null
          audio_track_state?: string | null
          billing_media_class?: string | null
          brb_until?: string | null
          created_at?: string
          daily_participant_state?: string | null
          event_type: string
          heartbeat_at?: string | null
          id?: string
          media_track_state?: Json
          metadata?: Json
          presence_mode: string
          room_id: string
          user_id: string
          video_track_state?: string | null
          visible_state?: string | null
        }
        Update: {
          access_session_id?: string | null
          audio_track_state?: string | null
          billing_media_class?: string | null
          brb_until?: string | null
          created_at?: string
          daily_participant_state?: string | null
          event_type?: string
          heartbeat_at?: string | null
          id?: string
          media_track_state?: Json
          metadata?: Json
          presence_mode?: string
          room_id?: string
          user_id?: string
          video_track_state?: string | null
          visible_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_presence_events_access_session_id_fkey"
            columns: ["access_session_id"]
            isOneToOne: false
            referencedRelation: "room_access_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_presence_events_room_fk"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_presence_events_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_reconciliation_items: {
        Row: {
          created_at: string
          daily_room_name: string | null
          daily_room_url: string | null
          description: string | null
          fix_result: Json | null
          fixed_at: string | null
          fixed_by_admin_user_id: string | null
          id: string
          ignored_at: string | null
          ignored_by_admin_user_id: string | null
          issue_type: string
          metadata: Json
          recommended_action: string | null
          room_id: string | null
          run_id: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_room_name?: string | null
          daily_room_url?: string | null
          description?: string | null
          fix_result?: Json | null
          fixed_at?: string | null
          fixed_by_admin_user_id?: string | null
          id?: string
          ignored_at?: string | null
          ignored_by_admin_user_id?: string | null
          issue_type: string
          metadata?: Json
          recommended_action?: string | null
          room_id?: string | null
          run_id?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_room_name?: string | null
          daily_room_url?: string | null
          description?: string | null
          fix_result?: Json | null
          fixed_at?: string | null
          fixed_by_admin_user_id?: string | null
          id?: string
          ignored_at?: string | null
          ignored_by_admin_user_id?: string | null
          issue_type?: string
          metadata?: Json
          recommended_action?: string | null
          room_id?: string | null
          run_id?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_reconciliation_items_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_reconciliation_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "room_reconciliation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      room_reconciliation_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          detected_items: number
          failed_items: number
          fixed_items: number
          id: string
          run_type: string
          scanned_daily_rooms: number
          scanned_supabase_rooms: number
          started_at: string
          status: string
          summary: Json
          triggered_by_admin_user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          detected_items?: number
          failed_items?: number
          fixed_items?: number
          id?: string
          run_type?: string
          scanned_daily_rooms?: number
          scanned_supabase_rooms?: number
          started_at?: string
          status?: string
          summary?: Json
          triggered_by_admin_user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          detected_items?: number
          failed_items?: number
          fixed_items?: number
          id?: string
          run_type?: string
          scanned_daily_rooms?: number
          scanned_supabase_rooms?: number
          started_at?: string
          status?: string
          summary?: Json
          triggered_by_admin_user_id?: string | null
        }
        Relationships: []
      }
      room_session_summaries: {
        Row: {
          actual_ended_at: string | null
          actual_started_at: string | null
          connected_participant_count: number
          end_reason: string | null
          estimated_provider_cost_usd: number
          generated_at: string
          last_error: string | null
          participant_count: number
          room_category: string | null
          room_id: string
          room_mode: string | null
          room_title: string | null
          scheduled_duration_minutes: number
          scheduled_end_at: string | null
          scheduled_start_at: string | null
          source_access_session_count: number
          source_event_count: number
          status: string
          summary_version: string
          total_audio_only_seconds: number
          total_participant_minutes: number
          total_presence_seconds: number
          total_visual_seconds: number
          updated_at: string
          visibility: string | null
        }
        Insert: {
          actual_ended_at?: string | null
          actual_started_at?: string | null
          connected_participant_count?: number
          end_reason?: string | null
          estimated_provider_cost_usd?: number
          generated_at?: string
          last_error?: string | null
          participant_count?: number
          room_category?: string | null
          room_id: string
          room_mode?: string | null
          room_title?: string | null
          scheduled_duration_minutes?: number
          scheduled_end_at?: string | null
          scheduled_start_at?: string | null
          source_access_session_count?: number
          source_event_count?: number
          status?: string
          summary_version: string
          total_audio_only_seconds?: number
          total_participant_minutes?: number
          total_presence_seconds?: number
          total_visual_seconds?: number
          updated_at?: string
          visibility?: string | null
        }
        Update: {
          actual_ended_at?: string | null
          actual_started_at?: string | null
          connected_participant_count?: number
          end_reason?: string | null
          estimated_provider_cost_usd?: number
          generated_at?: string
          last_error?: string | null
          participant_count?: number
          room_category?: string | null
          room_id?: string
          room_mode?: string | null
          room_title?: string | null
          scheduled_duration_minutes?: number
          scheduled_end_at?: string | null
          scheduled_start_at?: string | null
          source_access_session_count?: number
          source_event_count?: number
          status?: string
          summary_version?: string
          total_audio_only_seconds?: number
          total_participant_minutes?: number
          total_presence_seconds?: number
          total_visual_seconds?: number
          updated_at?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_session_summaries_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          cleanup_reason: string | null
          created_at: string
          created_by: string
          daily_room_delete_error: string | null
          daily_room_deleted_at: string | null
          daily_room_url: string | null
          duration_minutes: number
          ended_at: string | null
          host_note: string | null
          id: string
          interaction_style: string
          invite_code: string | null
          last_presence_at: string | null
          max_size: number
          mode: string
          room_category: string
          scheduled_end_at: string | null
          started_at: string | null
          status: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          cleanup_reason?: string | null
          created_at?: string
          created_by: string
          daily_room_delete_error?: string | null
          daily_room_deleted_at?: string | null
          daily_room_url?: string | null
          duration_minutes: number
          ended_at?: string | null
          host_note?: string | null
          id?: string
          interaction_style?: string
          invite_code?: string | null
          last_presence_at?: string | null
          max_size: number
          mode: string
          room_category?: string
          scheduled_end_at?: string | null
          started_at?: string | null
          status?: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          cleanup_reason?: string | null
          created_at?: string
          created_by?: string
          daily_room_delete_error?: string | null
          daily_room_deleted_at?: string | null
          daily_room_url?: string | null
          duration_minutes?: number
          ended_at?: string | null
          host_note?: string | null
          id?: string
          interaction_style?: string
          invite_code?: string | null
          last_presence_at?: string | null
          max_size?: number
          mode?: string
          room_category?: string
          scheduled_end_at?: string | null
          started_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      scheduled_room_posts: {
        Row: {
          created_at: string
          duration_minutes: number | null
          end_at: string
          host_user_id: string
          id: string
          interaction_style: string
          invite_code: string | null
          note: string | null
          room_category: string
          seat_limit: number
          start_at: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          end_at: string
          host_user_id: string
          id?: string
          interaction_style: string
          invite_code?: string | null
          note?: string | null
          room_category?: string
          seat_limit?: number
          start_at: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          end_at?: string
          host_user_id?: string
          id?: string
          interaction_style?: string
          invite_code?: string | null
          note?: string | null
          room_category?: string
          seat_limit?: number
          start_at?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      security_audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          details: Json
          id: number
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          id?: number
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          id?: number
          target_user_id?: string | null
        }
        Relationships: []
      }
      subscription_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          merchant_trade_no: string | null
          payment_order_id: string | null
          provider_payload: Json
          subscription_profile_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          merchant_trade_no?: string | null
          payment_order_id?: string | null
          provider_payload?: Json
          subscription_profile_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          merchant_trade_no?: string | null
          payment_order_id?: string | null
          provider_payload?: Json
          subscription_profile_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_payment_order_id_fkey"
            columns: ["payment_order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_subscription_profile_id_fkey"
            columns: ["subscription_profile_id"]
            isOneToOne: false
            referencedRelation: "subscription_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payment_applications: {
        Row: {
          applied_at: string
          metadata: Json
          payment_order_id: string
          period_end: string
          period_start: string
          plan_code: string
          reversal_refund_request_id: string | null
          reversed_at: string | null
          status: string
          subscription_profile_id: string | null
          user_id: string
        }
        Insert: {
          applied_at?: string
          metadata?: Json
          payment_order_id: string
          period_end: string
          period_start: string
          plan_code: string
          reversal_refund_request_id?: string | null
          reversed_at?: string | null
          status?: string
          subscription_profile_id?: string | null
          user_id: string
        }
        Update: {
          applied_at?: string
          metadata?: Json
          payment_order_id?: string
          period_end?: string
          period_start?: string
          plan_code?: string
          reversal_refund_request_id?: string | null
          reversed_at?: string | null
          status?: string
          subscription_profile_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payment_applicatio_reversal_refund_request_id_fkey"
            columns: ["reversal_refund_request_id"]
            isOneToOne: false
            referencedRelation: "refund_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payment_applications_payment_order_id_fkey"
            columns: ["payment_order_id"]
            isOneToOne: true
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payment_applications_subscription_profile_id_fkey"
            columns: ["subscription_profile_id"]
            isOneToOne: false
            referencedRelation: "subscription_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_profiles: {
        Row: {
          admin_note: string | null
          auto_renew: boolean
          cancel_reason: string | null
          cancel_requested_at: string | null
          cancel_requested_by_user_id: string | null
          cancelled_at: string | null
          commercial_entitlement_status: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          entitlement_applied_at: string | null
          exec_times: number
          frequency: number
          id: string
          invoice_preference: Json | null
          last_provider_error: string | null
          merchant_member_id: string | null
          merchant_trade_no: string | null
          next_charge_at: string | null
          period_amount: number
          period_type: string
          plan_code: string
          provider: string
          provider_profile_id: string | null
          raw_payload: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          auto_renew?: boolean
          cancel_reason?: string | null
          cancel_requested_at?: string | null
          cancel_requested_by_user_id?: string | null
          cancelled_at?: string | null
          commercial_entitlement_status?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          entitlement_applied_at?: string | null
          exec_times?: number
          frequency?: number
          id?: string
          invoice_preference?: Json | null
          last_provider_error?: string | null
          merchant_member_id?: string | null
          merchant_trade_no?: string | null
          next_charge_at?: string | null
          period_amount?: number
          period_type?: string
          plan_code: string
          provider?: string
          provider_profile_id?: string | null
          raw_payload?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          auto_renew?: boolean
          cancel_reason?: string | null
          cancel_requested_at?: string | null
          cancel_requested_by_user_id?: string | null
          cancelled_at?: string | null
          commercial_entitlement_status?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          entitlement_applied_at?: string | null
          exec_times?: number
          frequency?: number
          id?: string
          invoice_preference?: Json | null
          last_provider_error?: string | null
          merchant_member_id?: string | null
          merchant_trade_no?: string | null
          next_charge_at?: string | null
          period_amount?: number
          period_type?: string
          plan_code?: string
          provider?: string
          provider_profile_id?: string | null
          raw_payload?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_ticket_events: {
        Row: {
          actor_role: string
          actor_user_id: string | null
          created_at: string
          event_type: string
          from_status: string | null
          id: string
          metadata: Json
          ticket_id: string
          to_status: string | null
        }
        Insert: {
          actor_role?: string
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: string
          metadata?: Json
          ticket_id: string
          to_status?: string | null
        }
        Update: {
          actor_role?: string
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          ticket_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          metadata: Json
          sender_role: string
          sender_user_id: string | null
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          metadata?: Json
          sender_role?: string
          sender_user_id?: string | null
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          metadata?: Json
          sender_role?: string
          sender_user_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_note: string | null
          assigned_admin_user_id: string | null
          category: string
          closed_at: string | null
          created_at: string
          description: string
          id: string
          last_admin_message_at: string | null
          last_user_message_at: string | null
          metadata: Json
          priority: string
          related_booking_id: string | null
          related_payment_order_id: string | null
          related_room_id: string | null
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          assigned_admin_user_id?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          description?: string
          id?: string
          last_admin_message_at?: string | null
          last_user_message_at?: string | null
          metadata?: Json
          priority?: string
          related_booking_id?: string | null
          related_payment_order_id?: string | null
          related_room_id?: string | null
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          assigned_admin_user_id?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          description?: string
          id?: string
          last_admin_message_at?: string | null
          last_user_message_at?: string | null
          metadata?: Json
          priority?: string
          related_booking_id?: string | null
          related_payment_order_id?: string | null
          related_room_id?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_related_booking_id_fkey"
            columns: ["related_booking_id"]
            isOneToOne: false
            referencedRelation: "buddy_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_related_payment_order_id_fkey"
            columns: ["related_payment_order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_related_room_id_fkey"
            columns: ["related_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          block_scope: string
          blocked_user_id: string | null
          blocker_user_id: string | null
          created_at: string
          email: string
          id: string | null
          reason: string
          source_report_id: string | null
          user_id: string
        }
        Insert: {
          block_scope?: string
          blocked_user_id?: string | null
          blocker_user_id?: string | null
          created_at?: string
          email: string
          id?: string | null
          reason: string
          source_report_id?: string | null
          user_id: string
        }
        Update: {
          block_scope?: string
          blocked_user_id?: string | null
          blocker_user_id?: string | null
          created_at?: string
          email?: string
          id?: string | null
          reason?: string
          source_report_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_entitlements: {
        Row: {
          created_at: string
          plan: string
          updated_at: string
          user_id: string
          vip_until: string | null
        }
        Insert: {
          created_at?: string
          plan?: string
          updated_at?: string
          user_id: string
          vip_until?: string | null
        }
        Update: {
          created_at?: string
          plan?: string
          updated_at?: string
          user_id?: string
          vip_until?: string | null
        }
        Relationships: []
      }
      user_identity_bindings: {
        Row: {
          binding_type: string
          binding_value_masked: string | null
          created_at: string
          id: string
          metadata: Json
          revoked_at: string | null
          source: string
          status: string
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          binding_type: string
          binding_value_masked?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          revoked_at?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          binding_type?: string
          binding_value_masked?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          revoked_at?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      user_invoice_preferences: {
        Row: {
          created_at: string
          preference: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          preference?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          preference?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_plan_entitlements: {
        Row: {
          auto_renew: boolean
          cancel_at_period_end: boolean
          created_at: string
          id: string
          metadata: Json
          plan_code: string
          source_payment_order_id: string | null
          source_subscription_profile_id: string | null
          status: string
          updated_at: string
          user_id: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          auto_renew?: boolean
          cancel_at_period_end?: boolean
          created_at?: string
          id?: string
          metadata?: Json
          plan_code: string
          source_payment_order_id?: string | null
          source_subscription_profile_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
          valid_from: string
          valid_until: string
        }
        Update: {
          auto_renew?: boolean
          cancel_at_period_end?: boolean
          created_at?: string
          id?: string
          metadata?: Json
          plan_code?: string
          source_payment_order_id?: string | null
          source_subscription_profile_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_plan_entitlements_source_payment_order_id_fkey"
            columns: ["source_payment_order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_plan_entitlements_source_subscription_profile_id_fkey"
            columns: ["source_subscription_profile_id"]
            isOneToOne: false
            referencedRelation: "subscription_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_private_profile_settings: {
        Row: {
          created_at: string
          notify_friend_requests: boolean
          notify_room_reminders: boolean
          notify_schedule_updates: boolean
          payment_card_brand: string | null
          payment_card_last4: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          notify_friend_requests?: boolean
          notify_room_reminders?: boolean
          notify_schedule_updates?: boolean
          payment_card_brand?: string | null
          payment_card_last4?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          notify_friend_requests?: boolean
          notify_room_reminders?: boolean
          notify_schedule_updates?: boolean
          payment_card_brand?: string | null
          payment_card_last4?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_reports: {
        Row: {
          admin_note: string | null
          category: string
          created_at: string
          description: string
          id: string
          linked_moderation_case_id: string | null
          metadata: Json
          reporter_user_id: string
          severity: string
          status: string
          target_buddy_booking_id: string | null
          target_buddy_service_id: string | null
          target_room_id: string | null
          target_type: string
          target_user_id: string | null
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          category: string
          created_at?: string
          description?: string
          id?: string
          linked_moderation_case_id?: string | null
          metadata?: Json
          reporter_user_id: string
          severity?: string
          status?: string
          target_buddy_booking_id?: string | null
          target_buddy_service_id?: string | null
          target_room_id?: string | null
          target_type: string
          target_user_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          linked_moderation_case_id?: string | null
          metadata?: Json
          reporter_user_id?: string
          severity?: string
          status?: string
          target_buddy_booking_id?: string | null
          target_buddy_service_id?: string | null
          target_room_id?: string | null
          target_type?: string
          target_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_reports_linked_moderation_case_id_fkey"
            columns: ["linked_moderation_case_id"]
            isOneToOne: false
            referencedRelation: "moderation_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_target_buddy_booking_id_fkey"
            columns: ["target_buddy_booking_id"]
            isOneToOne: false
            referencedRelation: "buddy_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_target_buddy_service_id_fkey"
            columns: ["target_buddy_service_id"]
            isOneToOne: false
            referencedRelation: "buddy_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_target_room_id_fkey"
            columns: ["target_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      user_security_flags: {
        Row: {
          block_reason: string | null
          block_scope: string
          blocked_at: string | null
          blocked_by: string | null
          bound_phone_hash: string | null
          created_at: string
          last_auth_provider: string | null
          phone_conflict: boolean
          phone_verified_at: string | null
          require_phone_verification: boolean
          risk_level: string
          updated_at: string
          user_id: string
        }
        Insert: {
          block_reason?: string | null
          block_scope?: string
          blocked_at?: string | null
          blocked_by?: string | null
          bound_phone_hash?: string | null
          created_at?: string
          last_auth_provider?: string | null
          phone_conflict?: boolean
          phone_verified_at?: string | null
          require_phone_verification?: boolean
          risk_level?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          block_reason?: string | null
          block_scope?: string
          blocked_at?: string | null
          blocked_by?: string | null
          bound_phone_hash?: string | null
          created_at?: string
          last_auth_provider?: string | null
          phone_conflict?: boolean
          phone_verified_at?: string | null
          require_phone_verification?: boolean
          risk_level?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_usage_wallet_events: {
        Row: {
          access_session_id: string | null
          balance_after: number
          created_at: string
          delta_quantity: number
          event_type: string
          id: string
          idempotency_key: string
          metadata: Json
          overage_delta: number
          payment_order_id: string | null
          resource_key: string
          room_id: string | null
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          access_session_id?: string | null
          balance_after?: number
          created_at?: string
          delta_quantity?: number
          event_type: string
          id?: string
          idempotency_key: string
          metadata?: Json
          overage_delta?: number
          payment_order_id?: string | null
          resource_key: string
          room_id?: string | null
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          access_session_id?: string | null
          balance_after?: number
          created_at?: string
          delta_quantity?: number
          event_type?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          overage_delta?: number
          payment_order_id?: string | null
          resource_key?: string
          room_id?: string | null
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_usage_wallet_events_access_session_id_fkey"
            columns: ["access_session_id"]
            isOneToOne: false
            referencedRelation: "room_access_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_usage_wallet_events_payment_order_id_fkey"
            columns: ["payment_order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_usage_wallet_events_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_usage_wallet_events_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "user_usage_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_usage_wallets: {
        Row: {
          consumed_quantity: number
          created_at: string
          granted_quantity: number
          id: string
          metadata: Json
          overage_quantity: number
          period_end: string
          period_start: string
          plan_code: string
          resource_key: string
          source_payment_order_id: string | null
          source_subscription_profile_id: string | null
          status: string
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          consumed_quantity?: number
          created_at?: string
          granted_quantity?: number
          id?: string
          metadata?: Json
          overage_quantity?: number
          period_end: string
          period_start: string
          plan_code: string
          resource_key: string
          source_payment_order_id?: string | null
          source_subscription_profile_id?: string | null
          status?: string
          unit: string
          updated_at?: string
          user_id: string
        }
        Update: {
          consumed_quantity?: number
          created_at?: string
          granted_quantity?: number
          id?: string
          metadata?: Json
          overage_quantity?: number
          period_end?: string
          period_start?: string
          plan_code?: string
          resource_key?: string
          source_payment_order_id?: string | null
          source_subscription_profile_id?: string | null
          status?: string
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_usage_wallets_source_payment_order_id_fkey"
            columns: ["source_payment_order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_usage_wallets_source_subscription_profile_id_fkey"
            columns: ["source_subscription_profile_id"]
            isOneToOne: false
            referencedRelation: "subscription_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verified_phone_identities: {
        Row: {
          first_verified_at: string
          last_verified_at: string
          phone_e164: string
          phone_hash: string
          user_id: string
        }
        Insert: {
          first_verified_at?: string
          last_verified_at?: string
          phone_e164: string
          phone_hash: string
          user_id: string
        }
        Update: {
          first_verified_at?: string
          last_verified_at?: string
          phone_e164?: string
          phone_hash?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      billing_release_job_lock: {
        Args: { p_job_name: string; p_locked_by: string }
        Returns: boolean
      }
      billing_try_acquire_job_lock: {
        Args: {
          p_job_name: string
          p_lock_seconds: number
          p_locked_by: string
        }
        Returns: boolean
      }
      can_join_room: {
        Args: { p_room_id: string; p_user_id: string }
        Returns: boolean
      }
      cleanup_rooms_and_schedules: { Args: never; Returns: Json }
      cowork_append_appeal_message: {
        Args: {
          p_actor_role: string
          p_actor_user_id: string
          p_appeal_id: string
          p_body: string
          p_metadata?: Json
        }
        Returns: Json
      }
      cowork_apply_buddy_payment_v3: {
        Args: {
          p_booking_id: string
          p_buyer_user_id: string
          p_metadata?: Json
          p_paid_at: string
          p_payment_order_id: string
          p_platform_fee_bps: number
        }
        Returns: Json
      }
      cowork_apply_presence_usage: {
        Args: {
          p_access_session_id: string
          p_connected: boolean
          p_current_media_class: string
          p_delta_seconds: number
          p_interval_media_class: string
          p_screen_share_on: boolean
        }
        Returns: {
          allowed_by_pair_vip_carry: boolean
          audio_only_seconds: number
          billable_participant_minutes: number
          billing_media_class: string
          billing_session_key: string
          charge_status: string
          charged_at: string | null
          commercial_plan_code: string | null
          connected_at: string | null
          connected_seconds: number
          cost_credits: number
          created_at: string
          daily_room_name: string
          disconnected_at: string | null
          duration_minutes: number
          entitlement_source: string
          estimated_provider_cost_usd: number
          id: string
          join_confirmed_at: string | null
          last_error: string | null
          last_presence_at: string | null
          last_token_issued_at: string | null
          provider_payload: Json
          reconciled_at: string | null
          reconciliation_source: string | null
          room_id: string
          screen_share_seconds: number
          status: string
          token_exp: string | null
          updated_at: string
          usage_status: string
          user_id: string
          visual_seconds: number
          wallet_visual_debited_seconds: number
          wallet_visual_overage_seconds: number
        }
        SetofOptions: {
          from: "*"
          to: "room_access_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cowork_apply_subscription_payment_v2: {
        Args: {
          p_metadata?: Json
          p_payment_order_id: string
          p_period_end: string
          p_period_start: string
          p_plan_code: string
          p_source?: string
          p_subscription_profile_id: string
          p_user_id: string
        }
        Returns: Json
      }
      cowork_claim_buddy_room_provision_v3: {
        Args: {
          p_booking_id: string
          p_early_minutes?: number
          p_late_minutes?: number
          p_user_id: string
        }
        Returns: Json
      }
      cowork_cleanup_expired_rooms: {
        Args: { p_grace_minutes?: number; p_presence_grace_minutes?: number }
        Returns: Json
      }
      cowork_close_appeal: {
        Args: { p_appeal_id: string; p_user_id: string }
        Returns: Json
      }
      cowork_confirm_buddy_completion_v3: {
        Args: { p_booking_id: string; p_hold_hours: number; p_user_id: string }
        Returns: Json
      }
      cowork_consume_usage_wallet_v2: {
        Args: {
          p_access_session_id?: string
          p_allow_overage?: boolean
          p_idempotency_key: string
          p_metadata?: Json
          p_payment_order_id?: string
          p_quantity: number
          p_resource_key: string
          p_room_id?: string
          p_user_id: string
        }
        Returns: Json
      }
      cowork_create_appeal: {
        Args: {
          p_idempotency_key: string
          p_message: string
          p_metadata?: Json
          p_moderation_action_id: string
          p_moderation_case_id: string
          p_reason_code: string
          p_requested_outcome: string
          p_user_id: string
        }
        Returns: Json
      }
      cowork_create_buddy_booking_v3: {
        Args: {
          p_buyer_note: string
          p_buyer_user_id: string
          p_max_amount_twd: number
          p_service_id: string
          p_slot_id: string
        }
        Returns: Json
      }
      cowork_create_buddy_payout_batch_v3: {
        Args: {
          p_admin_user_id: string
          p_note: string
          p_provider_user_id: string
          p_settlement_ids: string[]
        }
        Returns: Json
      }
      cowork_end_room_for_user: {
        Args: { p_reason?: string; p_room_id: string; p_user_id: string }
        Returns: Json
      }
      cowork_expire_unpaid_buddy_bookings_v3: {
        Args: { p_limit?: number }
        Returns: Json
      }
      cowork_finalize_room_extension_v2: {
        Args: {
          p_extension_window_key: string
          p_idempotency_key: string
          p_metadata?: Json
          p_room_id: string
          p_sponsor_user_id: string
        }
        Returns: Json
      }
      cowork_finish_buddy_room_provision_v3: {
        Args: {
          p_actor_user_id: string
          p_booking_id: string
          p_error: string
          p_invite_code: string
          p_room_id: string
        }
        Returns: Json
      }
      cowork_hold_buddy_settlement_v3: {
        Args: {
          p_actor_user_id: string
          p_booking_id: string
          p_dispute_id?: string
          p_reason: string
        }
        Returns: Json
      }
      cowork_join_room_with_capacity: {
        Args: { p_room_id: string; p_user_id: string }
        Returns: Json
      }
      cowork_leave_room: {
        Args: { p_reason?: string; p_room_id: string; p_user_id: string }
        Returns: Json
      }
      cowork_promote_buddy_settlements_v3: {
        Args: { p_limit?: number }
        Returns: Json
      }
      cowork_release_buddy_settlement_v3: {
        Args: {
          p_admin_user_id: string
          p_booking_id: string
          p_reason: string
        }
        Returns: Json
      }
      cowork_resolve_buddy_dispute_v3: {
        Args: {
          p_action: string
          p_admin_note: string
          p_admin_user_id: string
          p_dispute_id: string
          p_settlement_resolution: string
        }
        Returns: Json
      }
      cowork_reverse_buddy_payment_v3: {
        Args: {
          p_payment_order_id: string
          p_refund_amount_twd: number
          p_refund_request_id: string
        }
        Returns: Json
      }
      cowork_reverse_subscription_payment_v2: {
        Args: {
          p_metadata?: Json
          p_payment_order_id: string
          p_refund_amount_twd?: number
          p_refund_request_id: string
          p_source?: string
        }
        Returns: Json
      }
      cowork_room_friend_action_v4a: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_message?: string
          p_room_id: string
          p_target_user_id: string
        }
        Returns: Json
      }
      cowork_room_owner_action_v4a: {
        Args: {
          p_action: string
          p_client_eject_confirmed?: boolean
          p_owner_user_id: string
          p_room_id: string
          p_target_user_id?: string
        }
        Returns: Json
      }
      cowork_transition_appeal: {
        Args: {
          p_admin_response: string
          p_admin_user_id: string
          p_appeal_id: string
          p_create_restore_action?: boolean
          p_decision_reason: string
          p_metadata?: Json
          p_to_status: string
        }
        Returns: Json
      }
      cowork_transition_buddy_booking_v3: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_booking_id: string
          p_linked_room_id: string
          p_linked_room_invite_code: string
          p_note: string
        }
        Returns: Json
      }
      cowork_transition_buddy_payout_batch_v3: {
        Args: {
          p_action: string
          p_admin_user_id: string
          p_batch_id: string
          p_note: string
          p_provider_reference: string
        }
        Returns: Json
      }
      cowork_try_consume_credits: {
        Args: {
          p_allowance: number
          p_cost: number
          p_month_start: string
          p_user_id: string
        }
        Returns: number
      }
      cowork_try_consume_identity_credits: {
        Args: {
          p_allowance?: number
          p_cost: number
          p_identity_key: string
          p_month_start: string
          p_user_id: string
        }
        Returns: number
      }
      ecpay_mark_order_paid: {
        Args: {
          p_merchant_trade_no: string
          p_paid_at?: string
          p_provider_payload?: Json
          p_provider_trade_no?: string
        }
        Returns: Json
      }
      generate_room_invite_code: { Args: never; Returns: string }
      viewer_is_friend: {
        Args: { p_left: string; p_right: string }
        Returns: boolean
      }
      viewer_is_vip: { Args: { p_user_id: string }; Returns: boolean }
    }
    Enums: {
      ai_mode: "global-guide" | "room-personal" | "room-host"
      ai_session_status: "pending" | "active" | "ended" | "error"
      ai_usage_event_type:
        | "session_start"
        | "session_end"
        | "message"
        | "host_intervention"
        | "tts_start"
        | "tts_end"
        | "error"
      presence_mode: "quiet" | "audio" | "mosaic" | "camera"
      room_presence_event_type:
        | "selected"
        | "heartbeat"
        | "visible"
        | "hidden"
        | "audio_on"
        | "audio_off"
        | "video_on"
        | "video_off"
        | "brb_start"
        | "brb_end"
        | "extension_confirmed"
        | "left"
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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    Enums: {
      ai_mode: ["global-guide", "room-personal", "room-host"],
      ai_session_status: ["pending", "active", "ended", "error"],
      ai_usage_event_type: [
        "session_start",
        "session_end",
        "message",
        "host_intervention",
        "tts_start",
        "tts_end",
        "error",
      ],
      presence_mode: ["quiet", "audio", "mosaic", "camera"],
      room_presence_event_type: [
        "selected",
        "heartbeat",
        "visible",
        "hidden",
        "audio_on",
        "audio_off",
        "video_on",
        "video_off",
        "brb_start",
        "brb_end",
        "extension_confirmed",
        "left",
      ],
    },
  },
} as const
