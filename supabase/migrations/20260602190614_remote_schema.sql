
  create table "public"."admin_audit_logs" (
    "id" uuid not null default gen_random_uuid(),
    "actor_admin_user_id" uuid,
    "action_type" text not null,
    "target_type" text,
    "target_id" text,
    "ip_address" inet,
    "user_agent" text,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."admin_audit_logs" enable row level security;


  create table "public"."appeals" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "moderation_case_id" uuid,
    "moderation_action_id" uuid,
    "status" text not null default 'open'::text,
    "message" text not null,
    "admin_response" text,
    "resolved_by_admin_user_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "resolved_at" timestamp with time zone
      );


alter table "public"."appeals" enable row level security;


  create table "public"."billing_ledger" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "provider" text not null default 'internal'::text,
    "ledger_type" text not null,
    "direction" text not null,
    "amount_twd" integer not null default 0,
    "currency" text not null default 'TWD'::text,
    "payment_order_id" uuid,
    "buddy_booking_id" uuid,
    "room_id" uuid,
    "description" text,
    "metadata" jsonb not null default '{}'::jsonb,
    "occurred_at" timestamp with time zone not null default now(),
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."billing_ledger" enable row level security;


  create table "public"."entitlement_events" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "event_type" text not null,
    "plan_code" text,
    "entitlement_key" text not null default 'vip'::text,
    "quantity" integer not null default 1,
    "valid_from" timestamp with time zone,
    "valid_until" timestamp with time zone,
    "payment_order_id" uuid,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."entitlement_events" enable row level security;


  create table "public"."invoice_events" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "payment_order_id" uuid,
    "provider" text not null default 'ecpay_invoice'::text,
    "event_type" text not null,
    "invoice_number" text,
    "invoice_random_number" text,
    "issued_at" timestamp with time zone,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."invoice_events" enable row level security;


  create table "public"."moderation_actions" (
    "id" uuid not null default gen_random_uuid(),
    "case_id" uuid,
    "actor_admin_user_id" uuid,
    "target_user_id" uuid,
    "action_type" text not null,
    "reason" text,
    "starts_at" timestamp with time zone default now(),
    "expires_at" timestamp with time zone,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."moderation_actions" enable row level security;


  create table "public"."moderation_cases" (
    "id" uuid not null default gen_random_uuid(),
    "source_report_id" uuid,
    "target_type" text not null,
    "target_user_id" uuid,
    "target_room_id" uuid,
    "status" text not null default 'open'::text,
    "severity" text not null default 'normal'::text,
    "summary" text,
    "assigned_admin_user_id" uuid,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "closed_at" timestamp with time zone
      );


alter table "public"."moderation_cases" enable row level security;


  create table "public"."refund_events" (
    "id" uuid not null default gen_random_uuid(),
    "refund_request_id" uuid not null,
    "actor_user_id" uuid,
    "actor_role" text not null default 'system'::text,
    "event_type" text not null,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."refund_events" enable row level security;


  create table "public"."refund_requests" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "payment_order_id" uuid,
    "support_ticket_id" uuid,
    "amount_twd" integer,
    "reason_category" text not null default 'other'::text,
    "reason" text not null,
    "status" text not null default 'requested'::text,
    "provider" text not null default 'ecpay'::text,
    "provider_refund_id" text,
    "metadata" jsonb not null default '{}'::jsonb,
    "requested_at" timestamp with time zone not null default now(),
    "reviewed_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "reviewed_by_admin_user_id" uuid,
    "admin_note" text
      );


alter table "public"."refund_requests" enable row level security;


  create table "public"."reliability_events" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "room_id" uuid,
    "event_type" text not null,
    "severity" text not null default 'info'::text,
    "source" text not null default 'system'::text,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."reliability_events" enable row level security;


  create table "public"."support_ticket_events" (
    "id" uuid not null default gen_random_uuid(),
    "ticket_id" uuid not null,
    "actor_user_id" uuid,
    "actor_role" text not null default 'system'::text,
    "event_type" text not null,
    "from_status" text,
    "to_status" text,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."support_ticket_events" enable row level security;


  create table "public"."support_ticket_messages" (
    "id" uuid not null default gen_random_uuid(),
    "ticket_id" uuid not null,
    "sender_user_id" uuid,
    "sender_role" text not null default 'user'::text,
    "body" text not null,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."support_ticket_messages" enable row level security;


  create table "public"."support_tickets" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "category" text not null default 'other'::text,
    "subject" text not null,
    "description" text not null default ''::text,
    "status" text not null default 'open'::text,
    "priority" text not null default 'normal'::text,
    "related_room_id" uuid,
    "related_booking_id" uuid,
    "related_payment_order_id" uuid,
    "metadata" jsonb not null default '{}'::jsonb,
    "last_user_message_at" timestamp with time zone,
    "last_admin_message_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "closed_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "assigned_admin_user_id" uuid,
    "admin_note" text
      );


alter table "public"."support_tickets" enable row level security;


  create table "public"."user_reports" (
    "id" uuid not null default gen_random_uuid(),
    "reporter_user_id" uuid not null,
    "target_type" text not null,
    "target_user_id" uuid,
    "target_room_id" uuid,
    "target_buddy_service_id" uuid,
    "target_buddy_booking_id" uuid,
    "category" text not null,
    "description" text not null default ''::text,
    "status" text not null default 'open'::text,
    "severity" text not null default 'normal'::text,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "linked_moderation_case_id" uuid,
    "admin_note" text
      );


alter table "public"."user_reports" enable row level security;

alter table "public"."user_blocks" add column "blocked_user_id" uuid;

alter table "public"."user_blocks" add column "blocker_user_id" uuid;

alter table "public"."user_blocks" add column "source_report_id" uuid;

CREATE UNIQUE INDEX admin_audit_logs_pkey ON public.admin_audit_logs USING btree (id);

CREATE UNIQUE INDEX appeals_pkey ON public.appeals USING btree (id);

CREATE UNIQUE INDEX billing_ledger_pkey ON public.billing_ledger USING btree (id);

CREATE UNIQUE INDEX entitlement_events_pkey ON public.entitlement_events USING btree (id);

CREATE INDEX idx_admin_audit_logs_actor_created ON public.admin_audit_logs USING btree (actor_admin_user_id, created_at DESC);

CREATE INDEX idx_admin_audit_logs_target_created ON public.admin_audit_logs USING btree (target_type, target_id, created_at DESC);

CREATE INDEX idx_appeals_status_updated ON public.appeals USING btree (status, updated_at DESC);

CREATE INDEX idx_appeals_user_created ON public.appeals USING btree (user_id, created_at DESC);

CREATE INDEX idx_billing_ledger_order_type ON public.billing_ledger USING btree (payment_order_id, ledger_type) WHERE (payment_order_id IS NOT NULL);

CREATE INDEX idx_billing_ledger_payment_order ON public.billing_ledger USING btree (payment_order_id) WHERE (payment_order_id IS NOT NULL);

CREATE INDEX idx_billing_ledger_user_occurred ON public.billing_ledger USING btree (user_id, occurred_at DESC);

CREATE INDEX idx_entitlement_events_order_type_key ON public.entitlement_events USING btree (payment_order_id, event_type, entitlement_key) WHERE (payment_order_id IS NOT NULL);

CREATE INDEX idx_entitlement_events_user_created ON public.entitlement_events USING btree (user_id, created_at DESC);

CREATE INDEX idx_invoice_events_order_type ON public.invoice_events USING btree (payment_order_id, event_type) WHERE (payment_order_id IS NOT NULL);

CREATE INDEX idx_invoice_events_payment_order ON public.invoice_events USING btree (payment_order_id) WHERE (payment_order_id IS NOT NULL);

CREATE INDEX idx_invoice_events_user_created ON public.invoice_events USING btree (user_id, created_at DESC);

CREATE INDEX idx_moderation_actions_case_created ON public.moderation_actions USING btree (case_id, created_at DESC);

CREATE INDEX idx_moderation_actions_target_user_created ON public.moderation_actions USING btree (target_user_id, created_at DESC) WHERE (target_user_id IS NOT NULL);

CREATE INDEX idx_moderation_cases_status_updated ON public.moderation_cases USING btree (status, updated_at DESC);

CREATE INDEX idx_moderation_cases_target_user ON public.moderation_cases USING btree (target_user_id, created_at DESC) WHERE (target_user_id IS NOT NULL);

CREATE INDEX idx_refund_events_request_created ON public.refund_events USING btree (refund_request_id, created_at DESC);

CREATE INDEX idx_refund_requests_reviewed_by_admin ON public.refund_requests USING btree (reviewed_by_admin_user_id, reviewed_at DESC) WHERE (reviewed_by_admin_user_id IS NOT NULL);

CREATE INDEX idx_refund_requests_status_created ON public.refund_requests USING btree (status, created_at DESC);

CREATE INDEX idx_refund_requests_user_created ON public.refund_requests USING btree (user_id, created_at DESC);

CREATE INDEX idx_reliability_events_room_created ON public.reliability_events USING btree (room_id, created_at DESC) WHERE (room_id IS NOT NULL);

CREATE INDEX idx_reliability_events_user_created ON public.reliability_events USING btree (user_id, created_at DESC) WHERE (user_id IS NOT NULL);

CREATE INDEX idx_support_ticket_events_ticket_created ON public.support_ticket_events USING btree (ticket_id, created_at DESC);

CREATE INDEX idx_support_ticket_messages_sender_created ON public.support_ticket_messages USING btree (sender_user_id, created_at DESC);

CREATE INDEX idx_support_ticket_messages_ticket_created ON public.support_ticket_messages USING btree (ticket_id, created_at);

CREATE INDEX idx_support_tickets_assigned_admin ON public.support_tickets USING btree (assigned_admin_user_id, updated_at DESC) WHERE (assigned_admin_user_id IS NOT NULL);

CREATE INDEX idx_support_tickets_payment_order ON public.support_tickets USING btree (related_payment_order_id) WHERE (related_payment_order_id IS NOT NULL);

CREATE INDEX idx_support_tickets_related_room ON public.support_tickets USING btree (related_room_id) WHERE (related_room_id IS NOT NULL);

CREATE INDEX idx_support_tickets_status_updated ON public.support_tickets USING btree (status, updated_at DESC);

CREATE INDEX idx_support_tickets_user_created ON public.support_tickets USING btree (user_id, created_at DESC);

CREATE INDEX idx_user_blocks_blocked_user ON public.user_blocks USING btree (blocked_user_id, created_at DESC);

CREATE INDEX idx_user_blocks_blocker_user ON public.user_blocks USING btree (blocker_user_id, created_at DESC);

CREATE INDEX idx_user_reports_linked_case ON public.user_reports USING btree (linked_moderation_case_id) WHERE (linked_moderation_case_id IS NOT NULL);

CREATE INDEX idx_user_reports_reporter_created ON public.user_reports USING btree (reporter_user_id, created_at DESC);

CREATE INDEX idx_user_reports_status_created ON public.user_reports USING btree (status, created_at DESC);

CREATE INDEX idx_user_reports_target_room ON public.user_reports USING btree (target_room_id, created_at DESC) WHERE (target_room_id IS NOT NULL);

CREATE INDEX idx_user_reports_target_user ON public.user_reports USING btree (target_user_id, created_at DESC) WHERE (target_user_id IS NOT NULL);

CREATE UNIQUE INDEX invoice_events_pkey ON public.invoice_events USING btree (id);

CREATE UNIQUE INDEX moderation_actions_pkey ON public.moderation_actions USING btree (id);

CREATE UNIQUE INDEX moderation_cases_pkey ON public.moderation_cases USING btree (id);

CREATE UNIQUE INDEX refund_events_pkey ON public.refund_events USING btree (id);

CREATE UNIQUE INDEX refund_requests_pkey ON public.refund_requests USING btree (id);

CREATE UNIQUE INDEX reliability_events_pkey ON public.reliability_events USING btree (id);

CREATE UNIQUE INDEX support_ticket_events_pkey ON public.support_ticket_events USING btree (id);

CREATE UNIQUE INDEX support_ticket_messages_pkey ON public.support_ticket_messages USING btree (id);

CREATE UNIQUE INDEX support_tickets_pkey ON public.support_tickets USING btree (id);

CREATE UNIQUE INDEX user_blocks_unique_pair_idx ON public.user_blocks USING btree (blocker_user_id, blocked_user_id);

CREATE UNIQUE INDEX user_reports_pkey ON public.user_reports USING btree (id);

alter table "public"."admin_audit_logs" add constraint "admin_audit_logs_pkey" PRIMARY KEY using index "admin_audit_logs_pkey";

alter table "public"."appeals" add constraint "appeals_pkey" PRIMARY KEY using index "appeals_pkey";

alter table "public"."billing_ledger" add constraint "billing_ledger_pkey" PRIMARY KEY using index "billing_ledger_pkey";

alter table "public"."entitlement_events" add constraint "entitlement_events_pkey" PRIMARY KEY using index "entitlement_events_pkey";

alter table "public"."invoice_events" add constraint "invoice_events_pkey" PRIMARY KEY using index "invoice_events_pkey";

alter table "public"."moderation_actions" add constraint "moderation_actions_pkey" PRIMARY KEY using index "moderation_actions_pkey";

alter table "public"."moderation_cases" add constraint "moderation_cases_pkey" PRIMARY KEY using index "moderation_cases_pkey";

alter table "public"."refund_events" add constraint "refund_events_pkey" PRIMARY KEY using index "refund_events_pkey";

alter table "public"."refund_requests" add constraint "refund_requests_pkey" PRIMARY KEY using index "refund_requests_pkey";

alter table "public"."reliability_events" add constraint "reliability_events_pkey" PRIMARY KEY using index "reliability_events_pkey";

alter table "public"."support_ticket_events" add constraint "support_ticket_events_pkey" PRIMARY KEY using index "support_ticket_events_pkey";

alter table "public"."support_ticket_messages" add constraint "support_ticket_messages_pkey" PRIMARY KEY using index "support_ticket_messages_pkey";

alter table "public"."support_tickets" add constraint "support_tickets_pkey" PRIMARY KEY using index "support_tickets_pkey";

alter table "public"."user_reports" add constraint "user_reports_pkey" PRIMARY KEY using index "user_reports_pkey";

alter table "public"."admin_audit_logs" add constraint "admin_audit_logs_actor_admin_user_id_fkey" FOREIGN KEY (actor_admin_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."admin_audit_logs" validate constraint "admin_audit_logs_actor_admin_user_id_fkey";

alter table "public"."appeals" add constraint "appeals_message_len" CHECK (((char_length(message) >= 1) AND (char_length(message) <= 6000))) not valid;

alter table "public"."appeals" validate constraint "appeals_message_len";

alter table "public"."appeals" add constraint "appeals_moderation_action_id_fkey" FOREIGN KEY (moderation_action_id) REFERENCES public.moderation_actions(id) ON DELETE SET NULL not valid;

alter table "public"."appeals" validate constraint "appeals_moderation_action_id_fkey";

alter table "public"."appeals" add constraint "appeals_moderation_case_id_fkey" FOREIGN KEY (moderation_case_id) REFERENCES public.moderation_cases(id) ON DELETE SET NULL not valid;

alter table "public"."appeals" validate constraint "appeals_moderation_case_id_fkey";

alter table "public"."appeals" add constraint "appeals_resolved_by_admin_user_id_fkey" FOREIGN KEY (resolved_by_admin_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."appeals" validate constraint "appeals_resolved_by_admin_user_id_fkey";

alter table "public"."appeals" add constraint "appeals_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'reviewing'::text, 'accepted'::text, 'rejected'::text, 'closed'::text]))) not valid;

alter table "public"."appeals" validate constraint "appeals_status_check";

alter table "public"."appeals" add constraint "appeals_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."appeals" validate constraint "appeals_user_id_fkey";

alter table "public"."billing_ledger" add constraint "billing_ledger_buddy_booking_id_fkey" FOREIGN KEY (buddy_booking_id) REFERENCES public.buddy_bookings(id) ON DELETE SET NULL not valid;

alter table "public"."billing_ledger" validate constraint "billing_ledger_buddy_booking_id_fkey";

alter table "public"."billing_ledger" add constraint "billing_ledger_currency_check" CHECK ((currency = 'TWD'::text)) not valid;

alter table "public"."billing_ledger" validate constraint "billing_ledger_currency_check";

alter table "public"."billing_ledger" add constraint "billing_ledger_direction_check" CHECK ((direction = ANY (ARRAY['debit'::text, 'credit'::text, 'none'::text]))) not valid;

alter table "public"."billing_ledger" validate constraint "billing_ledger_direction_check";

alter table "public"."billing_ledger" add constraint "billing_ledger_payment_order_id_fkey" FOREIGN KEY (payment_order_id) REFERENCES public.payment_orders(id) ON DELETE SET NULL not valid;

alter table "public"."billing_ledger" validate constraint "billing_ledger_payment_order_id_fkey";

alter table "public"."billing_ledger" add constraint "billing_ledger_room_id_fkey" FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE SET NULL not valid;

alter table "public"."billing_ledger" validate constraint "billing_ledger_room_id_fkey";

alter table "public"."billing_ledger" add constraint "billing_ledger_type_check" CHECK ((ledger_type = ANY (ARRAY['payment'::text, 'refund'::text, 'entitlement_grant'::text, 'room_credit'::text, 'host_credit'::text, 'buddy_charge'::text, 'buddy_payout'::text, 'invoice'::text, 'manual_adjustment'::text, 'other'::text]))) not valid;

alter table "public"."billing_ledger" validate constraint "billing_ledger_type_check";

alter table "public"."billing_ledger" add constraint "billing_ledger_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."billing_ledger" validate constraint "billing_ledger_user_id_fkey";

alter table "public"."entitlement_events" add constraint "entitlement_events_event_type_check" CHECK ((event_type = ANY (ARRAY['grant'::text, 'extend'::text, 'revoke'::text, 'expire'::text, 'manual_adjustment'::text, 'sync'::text]))) not valid;

alter table "public"."entitlement_events" validate constraint "entitlement_events_event_type_check";

alter table "public"."entitlement_events" add constraint "entitlement_events_payment_order_id_fkey" FOREIGN KEY (payment_order_id) REFERENCES public.payment_orders(id) ON DELETE SET NULL not valid;

alter table "public"."entitlement_events" validate constraint "entitlement_events_payment_order_id_fkey";

alter table "public"."entitlement_events" add constraint "entitlement_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."entitlement_events" validate constraint "entitlement_events_user_id_fkey";

alter table "public"."invoice_events" add constraint "invoice_events_event_type_check" CHECK ((event_type = ANY (ARRAY['requested'::text, 'issued'::text, 'voided'::text, 'allowance'::text, 'failed'::text, 'manual_note'::text]))) not valid;

alter table "public"."invoice_events" validate constraint "invoice_events_event_type_check";

alter table "public"."invoice_events" add constraint "invoice_events_payment_order_id_fkey" FOREIGN KEY (payment_order_id) REFERENCES public.payment_orders(id) ON DELETE SET NULL not valid;

alter table "public"."invoice_events" validate constraint "invoice_events_payment_order_id_fkey";

alter table "public"."invoice_events" add constraint "invoice_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."invoice_events" validate constraint "invoice_events_user_id_fkey";

alter table "public"."moderation_actions" add constraint "moderation_actions_action_type_check" CHECK ((action_type = ANY (ARRAY['warn'::text, 'room_remove'::text, 'content_hide'::text, 'restrict_room_create'::text, 'restrict_buddies'::text, 'suspend'::text, 'ban'::text, 'restore'::text, 'note'::text]))) not valid;

alter table "public"."moderation_actions" validate constraint "moderation_actions_action_type_check";

alter table "public"."moderation_actions" add constraint "moderation_actions_actor_admin_user_id_fkey" FOREIGN KEY (actor_admin_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."moderation_actions" validate constraint "moderation_actions_actor_admin_user_id_fkey";

alter table "public"."moderation_actions" add constraint "moderation_actions_case_id_fkey" FOREIGN KEY (case_id) REFERENCES public.moderation_cases(id) ON DELETE SET NULL not valid;

alter table "public"."moderation_actions" validate constraint "moderation_actions_case_id_fkey";

alter table "public"."moderation_actions" add constraint "moderation_actions_target_user_id_fkey" FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."moderation_actions" validate constraint "moderation_actions_target_user_id_fkey";

alter table "public"."moderation_cases" add constraint "moderation_cases_assigned_admin_user_id_fkey" FOREIGN KEY (assigned_admin_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."moderation_cases" validate constraint "moderation_cases_assigned_admin_user_id_fkey";

alter table "public"."moderation_cases" add constraint "moderation_cases_severity_check" CHECK ((severity = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'critical'::text]))) not valid;

alter table "public"."moderation_cases" validate constraint "moderation_cases_severity_check";

alter table "public"."moderation_cases" add constraint "moderation_cases_source_report_id_fkey" FOREIGN KEY (source_report_id) REFERENCES public.user_reports(id) ON DELETE SET NULL not valid;

alter table "public"."moderation_cases" validate constraint "moderation_cases_source_report_id_fkey";

alter table "public"."moderation_cases" add constraint "moderation_cases_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'investigating'::text, 'action_required'::text, 'actioned'::text, 'dismissed'::text, 'closed'::text]))) not valid;

alter table "public"."moderation_cases" validate constraint "moderation_cases_status_check";

alter table "public"."moderation_cases" add constraint "moderation_cases_target_room_id_fkey" FOREIGN KEY (target_room_id) REFERENCES public.rooms(id) ON DELETE SET NULL not valid;

alter table "public"."moderation_cases" validate constraint "moderation_cases_target_room_id_fkey";

alter table "public"."moderation_cases" add constraint "moderation_cases_target_user_id_fkey" FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."moderation_cases" validate constraint "moderation_cases_target_user_id_fkey";

alter table "public"."refund_events" add constraint "refund_events_actor_role_check" CHECK ((actor_role = ANY (ARRAY['user'::text, 'admin'::text, 'system'::text]))) not valid;

alter table "public"."refund_events" validate constraint "refund_events_actor_role_check";

alter table "public"."refund_events" add constraint "refund_events_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."refund_events" validate constraint "refund_events_actor_user_id_fkey";

alter table "public"."refund_events" add constraint "refund_events_refund_request_id_fkey" FOREIGN KEY (refund_request_id) REFERENCES public.refund_requests(id) ON DELETE CASCADE not valid;

alter table "public"."refund_events" validate constraint "refund_events_refund_request_id_fkey";

alter table "public"."refund_requests" add constraint "refund_requests_payment_order_id_fkey" FOREIGN KEY (payment_order_id) REFERENCES public.payment_orders(id) ON DELETE SET NULL not valid;

alter table "public"."refund_requests" validate constraint "refund_requests_payment_order_id_fkey";

alter table "public"."refund_requests" add constraint "refund_requests_reason_category_check" CHECK ((reason_category = ANY (ARRAY['duplicate_payment'::text, 'service_issue'::text, 'accidental_purchase'::text, 'fraud'::text, 'billing_error'::text, 'other'::text]))) not valid;

alter table "public"."refund_requests" validate constraint "refund_requests_reason_category_check";

alter table "public"."refund_requests" add constraint "refund_requests_reason_len" CHECK (((char_length(reason) >= 1) AND (char_length(reason) <= 6000))) not valid;

alter table "public"."refund_requests" validate constraint "refund_requests_reason_len";

alter table "public"."refund_requests" add constraint "refund_requests_reviewed_by_admin_user_id_fkey" FOREIGN KEY (reviewed_by_admin_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."refund_requests" validate constraint "refund_requests_reviewed_by_admin_user_id_fkey";

alter table "public"."refund_requests" add constraint "refund_requests_status_check" CHECK ((status = ANY (ARRAY['requested'::text, 'reviewing'::text, 'approved'::text, 'rejected'::text, 'processing'::text, 'refunded'::text, 'failed'::text, 'cancelled'::text]))) not valid;

alter table "public"."refund_requests" validate constraint "refund_requests_status_check";

alter table "public"."refund_requests" add constraint "refund_requests_support_ticket_id_fkey" FOREIGN KEY (support_ticket_id) REFERENCES public.support_tickets(id) ON DELETE SET NULL not valid;

alter table "public"."refund_requests" validate constraint "refund_requests_support_ticket_id_fkey";

alter table "public"."refund_requests" add constraint "refund_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."refund_requests" validate constraint "refund_requests_user_id_fkey";

alter table "public"."reliability_events" add constraint "reliability_events_event_type_check" CHECK ((event_type = ANY (ARRAY['no_show'::text, 'late_join'::text, 'early_leave'::text, 'extension_no_response'::text, 'disconnect'::text, 'brb_overrun'::text, 'report_received'::text, 'room_cleanup'::text, 'daily_delete_failed'::text, 'daily_delete_success'::text, 'manual_note'::text]))) not valid;

alter table "public"."reliability_events" validate constraint "reliability_events_event_type_check";

alter table "public"."reliability_events" add constraint "reliability_events_room_id_fkey" FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE SET NULL not valid;

alter table "public"."reliability_events" validate constraint "reliability_events_room_id_fkey";

alter table "public"."reliability_events" add constraint "reliability_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."reliability_events" validate constraint "reliability_events_user_id_fkey";

alter table "public"."support_ticket_events" add constraint "support_ticket_events_actor_role_check" CHECK ((actor_role = ANY (ARRAY['user'::text, 'admin'::text, 'system'::text]))) not valid;

alter table "public"."support_ticket_events" validate constraint "support_ticket_events_actor_role_check";

alter table "public"."support_ticket_events" add constraint "support_ticket_events_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."support_ticket_events" validate constraint "support_ticket_events_actor_user_id_fkey";

alter table "public"."support_ticket_events" add constraint "support_ticket_events_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE not valid;

alter table "public"."support_ticket_events" validate constraint "support_ticket_events_ticket_id_fkey";

alter table "public"."support_ticket_messages" add constraint "support_ticket_messages_body_len" CHECK (((char_length(body) >= 1) AND (char_length(body) <= 8000))) not valid;

alter table "public"."support_ticket_messages" validate constraint "support_ticket_messages_body_len";

alter table "public"."support_ticket_messages" add constraint "support_ticket_messages_sender_role_check" CHECK ((sender_role = ANY (ARRAY['user'::text, 'admin'::text, 'system'::text]))) not valid;

alter table "public"."support_ticket_messages" validate constraint "support_ticket_messages_sender_role_check";

alter table "public"."support_ticket_messages" add constraint "support_ticket_messages_sender_user_id_fkey" FOREIGN KEY (sender_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."support_ticket_messages" validate constraint "support_ticket_messages_sender_user_id_fkey";

alter table "public"."support_ticket_messages" add constraint "support_ticket_messages_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE not valid;

alter table "public"."support_ticket_messages" validate constraint "support_ticket_messages_ticket_id_fkey";

alter table "public"."support_tickets" add constraint "support_tickets_assigned_admin_user_id_fkey" FOREIGN KEY (assigned_admin_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."support_tickets" validate constraint "support_tickets_assigned_admin_user_id_fkey";

alter table "public"."support_tickets" add constraint "support_tickets_category_check" CHECK ((category = ANY (ARRAY['payment'::text, 'invoice'::text, 'room'::text, 'account'::text, 'safety'::text, 'buddies'::text, 'ai'::text, 'refund'::text, 'technical'::text, 'other'::text]))) not valid;

alter table "public"."support_tickets" validate constraint "support_tickets_category_check";

alter table "public"."support_tickets" add constraint "support_tickets_description_len" CHECK ((char_length(description) <= 6000)) not valid;

alter table "public"."support_tickets" validate constraint "support_tickets_description_len";

alter table "public"."support_tickets" add constraint "support_tickets_priority_check" CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text]))) not valid;

alter table "public"."support_tickets" validate constraint "support_tickets_priority_check";

alter table "public"."support_tickets" add constraint "support_tickets_related_booking_id_fkey" FOREIGN KEY (related_booking_id) REFERENCES public.buddy_bookings(id) ON DELETE SET NULL not valid;

alter table "public"."support_tickets" validate constraint "support_tickets_related_booking_id_fkey";

alter table "public"."support_tickets" add constraint "support_tickets_related_payment_order_id_fkey" FOREIGN KEY (related_payment_order_id) REFERENCES public.payment_orders(id) ON DELETE SET NULL not valid;

alter table "public"."support_tickets" validate constraint "support_tickets_related_payment_order_id_fkey";

alter table "public"."support_tickets" add constraint "support_tickets_related_room_id_fkey" FOREIGN KEY (related_room_id) REFERENCES public.rooms(id) ON DELETE SET NULL not valid;

alter table "public"."support_tickets" validate constraint "support_tickets_related_room_id_fkey";

alter table "public"."support_tickets" add constraint "support_tickets_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'pending'::text, 'admin_review'::text, 'resolved'::text, 'closed'::text]))) not valid;

alter table "public"."support_tickets" validate constraint "support_tickets_status_check";

alter table "public"."support_tickets" add constraint "support_tickets_subject_len" CHECK (((char_length(subject) >= 4) AND (char_length(subject) <= 160))) not valid;

alter table "public"."support_tickets" validate constraint "support_tickets_subject_len";

alter table "public"."support_tickets" add constraint "support_tickets_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."support_tickets" validate constraint "support_tickets_user_id_fkey";

alter table "public"."user_blocks" add constraint "user_blocks_blocked_user_id_fkey" FOREIGN KEY (blocked_user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_blocks" validate constraint "user_blocks_blocked_user_id_fkey";

alter table "public"."user_blocks" add constraint "user_blocks_blocker_user_id_fkey" FOREIGN KEY (blocker_user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_blocks" validate constraint "user_blocks_blocker_user_id_fkey";

alter table "public"."user_reports" add constraint "user_reports_category_check" CHECK ((category = ANY (ARRAY['harassment'::text, 'sexual'::text, 'spam'::text, 'scam'::text, 'illegal'::text, 'self_harm'::text, 'privacy'::text, 'payment'::text, 'impersonation'::text, 'other'::text]))) not valid;

alter table "public"."user_reports" validate constraint "user_reports_category_check";

alter table "public"."user_reports" add constraint "user_reports_description_len" CHECK ((char_length(description) <= 6000)) not valid;

alter table "public"."user_reports" validate constraint "user_reports_description_len";

alter table "public"."user_reports" add constraint "user_reports_linked_moderation_case_id_fkey" FOREIGN KEY (linked_moderation_case_id) REFERENCES public.moderation_cases(id) ON DELETE SET NULL not valid;

alter table "public"."user_reports" validate constraint "user_reports_linked_moderation_case_id_fkey";

alter table "public"."user_reports" add constraint "user_reports_reporter_user_id_fkey" FOREIGN KEY (reporter_user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_reports" validate constraint "user_reports_reporter_user_id_fkey";

alter table "public"."user_reports" add constraint "user_reports_severity_check" CHECK ((severity = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'critical'::text]))) not valid;

alter table "public"."user_reports" validate constraint "user_reports_severity_check";

alter table "public"."user_reports" add constraint "user_reports_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'triaged'::text, 'actioned'::text, 'dismissed'::text, 'closed'::text]))) not valid;

alter table "public"."user_reports" validate constraint "user_reports_status_check";

alter table "public"."user_reports" add constraint "user_reports_target_buddy_booking_id_fkey" FOREIGN KEY (target_buddy_booking_id) REFERENCES public.buddy_bookings(id) ON DELETE SET NULL not valid;

alter table "public"."user_reports" validate constraint "user_reports_target_buddy_booking_id_fkey";

alter table "public"."user_reports" add constraint "user_reports_target_buddy_service_id_fkey" FOREIGN KEY (target_buddy_service_id) REFERENCES public.buddy_services(id) ON DELETE SET NULL not valid;

alter table "public"."user_reports" validate constraint "user_reports_target_buddy_service_id_fkey";

alter table "public"."user_reports" add constraint "user_reports_target_room_id_fkey" FOREIGN KEY (target_room_id) REFERENCES public.rooms(id) ON DELETE SET NULL not valid;

alter table "public"."user_reports" validate constraint "user_reports_target_room_id_fkey";

alter table "public"."user_reports" add constraint "user_reports_target_type_check" CHECK ((target_type = ANY (ARRAY['user'::text, 'room'::text, 'buddy_service'::text, 'buddy_booking'::text, 'payment_order'::text, 'ai'::text, 'other'::text]))) not valid;

alter table "public"."user_reports" validate constraint "user_reports_target_type_check";

alter table "public"."user_reports" add constraint "user_reports_target_user_id_fkey" FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."user_reports" validate constraint "user_reports_target_user_id_fkey";

grant delete on table "public"."admin_audit_logs" to "anon";

grant insert on table "public"."admin_audit_logs" to "anon";

grant references on table "public"."admin_audit_logs" to "anon";

grant select on table "public"."admin_audit_logs" to "anon";

grant trigger on table "public"."admin_audit_logs" to "anon";

grant truncate on table "public"."admin_audit_logs" to "anon";

grant update on table "public"."admin_audit_logs" to "anon";

grant delete on table "public"."admin_audit_logs" to "authenticated";

grant insert on table "public"."admin_audit_logs" to "authenticated";

grant references on table "public"."admin_audit_logs" to "authenticated";

grant select on table "public"."admin_audit_logs" to "authenticated";

grant trigger on table "public"."admin_audit_logs" to "authenticated";

grant truncate on table "public"."admin_audit_logs" to "authenticated";

grant update on table "public"."admin_audit_logs" to "authenticated";

grant delete on table "public"."admin_audit_logs" to "service_role";

grant insert on table "public"."admin_audit_logs" to "service_role";

grant references on table "public"."admin_audit_logs" to "service_role";

grant select on table "public"."admin_audit_logs" to "service_role";

grant trigger on table "public"."admin_audit_logs" to "service_role";

grant truncate on table "public"."admin_audit_logs" to "service_role";

grant update on table "public"."admin_audit_logs" to "service_role";

grant delete on table "public"."appeals" to "anon";

grant insert on table "public"."appeals" to "anon";

grant references on table "public"."appeals" to "anon";

grant select on table "public"."appeals" to "anon";

grant trigger on table "public"."appeals" to "anon";

grant truncate on table "public"."appeals" to "anon";

grant update on table "public"."appeals" to "anon";

grant delete on table "public"."appeals" to "authenticated";

grant insert on table "public"."appeals" to "authenticated";

grant references on table "public"."appeals" to "authenticated";

grant select on table "public"."appeals" to "authenticated";

grant trigger on table "public"."appeals" to "authenticated";

grant truncate on table "public"."appeals" to "authenticated";

grant update on table "public"."appeals" to "authenticated";

grant delete on table "public"."appeals" to "service_role";

grant insert on table "public"."appeals" to "service_role";

grant references on table "public"."appeals" to "service_role";

grant select on table "public"."appeals" to "service_role";

grant trigger on table "public"."appeals" to "service_role";

grant truncate on table "public"."appeals" to "service_role";

grant update on table "public"."appeals" to "service_role";

grant delete on table "public"."billing_ledger" to "anon";

grant insert on table "public"."billing_ledger" to "anon";

grant references on table "public"."billing_ledger" to "anon";

grant select on table "public"."billing_ledger" to "anon";

grant trigger on table "public"."billing_ledger" to "anon";

grant truncate on table "public"."billing_ledger" to "anon";

grant update on table "public"."billing_ledger" to "anon";

grant delete on table "public"."billing_ledger" to "authenticated";

grant insert on table "public"."billing_ledger" to "authenticated";

grant references on table "public"."billing_ledger" to "authenticated";

grant select on table "public"."billing_ledger" to "authenticated";

grant trigger on table "public"."billing_ledger" to "authenticated";

grant truncate on table "public"."billing_ledger" to "authenticated";

grant update on table "public"."billing_ledger" to "authenticated";

grant delete on table "public"."billing_ledger" to "service_role";

grant insert on table "public"."billing_ledger" to "service_role";

grant references on table "public"."billing_ledger" to "service_role";

grant select on table "public"."billing_ledger" to "service_role";

grant trigger on table "public"."billing_ledger" to "service_role";

grant truncate on table "public"."billing_ledger" to "service_role";

grant update on table "public"."billing_ledger" to "service_role";

grant delete on table "public"."entitlement_events" to "anon";

grant insert on table "public"."entitlement_events" to "anon";

grant references on table "public"."entitlement_events" to "anon";

grant select on table "public"."entitlement_events" to "anon";

grant trigger on table "public"."entitlement_events" to "anon";

grant truncate on table "public"."entitlement_events" to "anon";

grant update on table "public"."entitlement_events" to "anon";

grant delete on table "public"."entitlement_events" to "authenticated";

grant insert on table "public"."entitlement_events" to "authenticated";

grant references on table "public"."entitlement_events" to "authenticated";

grant select on table "public"."entitlement_events" to "authenticated";

grant trigger on table "public"."entitlement_events" to "authenticated";

grant truncate on table "public"."entitlement_events" to "authenticated";

grant update on table "public"."entitlement_events" to "authenticated";

grant delete on table "public"."entitlement_events" to "service_role";

grant insert on table "public"."entitlement_events" to "service_role";

grant references on table "public"."entitlement_events" to "service_role";

grant select on table "public"."entitlement_events" to "service_role";

grant trigger on table "public"."entitlement_events" to "service_role";

grant truncate on table "public"."entitlement_events" to "service_role";

grant update on table "public"."entitlement_events" to "service_role";

grant delete on table "public"."invoice_events" to "anon";

grant insert on table "public"."invoice_events" to "anon";

grant references on table "public"."invoice_events" to "anon";

grant select on table "public"."invoice_events" to "anon";

grant trigger on table "public"."invoice_events" to "anon";

grant truncate on table "public"."invoice_events" to "anon";

grant update on table "public"."invoice_events" to "anon";

grant delete on table "public"."invoice_events" to "authenticated";

grant insert on table "public"."invoice_events" to "authenticated";

grant references on table "public"."invoice_events" to "authenticated";

grant select on table "public"."invoice_events" to "authenticated";

grant trigger on table "public"."invoice_events" to "authenticated";

grant truncate on table "public"."invoice_events" to "authenticated";

grant update on table "public"."invoice_events" to "authenticated";

grant delete on table "public"."invoice_events" to "service_role";

grant insert on table "public"."invoice_events" to "service_role";

grant references on table "public"."invoice_events" to "service_role";

grant select on table "public"."invoice_events" to "service_role";

grant trigger on table "public"."invoice_events" to "service_role";

grant truncate on table "public"."invoice_events" to "service_role";

grant update on table "public"."invoice_events" to "service_role";

grant delete on table "public"."moderation_actions" to "anon";

grant insert on table "public"."moderation_actions" to "anon";

grant references on table "public"."moderation_actions" to "anon";

grant select on table "public"."moderation_actions" to "anon";

grant trigger on table "public"."moderation_actions" to "anon";

grant truncate on table "public"."moderation_actions" to "anon";

grant update on table "public"."moderation_actions" to "anon";

grant delete on table "public"."moderation_actions" to "authenticated";

grant insert on table "public"."moderation_actions" to "authenticated";

grant references on table "public"."moderation_actions" to "authenticated";

grant select on table "public"."moderation_actions" to "authenticated";

grant trigger on table "public"."moderation_actions" to "authenticated";

grant truncate on table "public"."moderation_actions" to "authenticated";

grant update on table "public"."moderation_actions" to "authenticated";

grant delete on table "public"."moderation_actions" to "service_role";

grant insert on table "public"."moderation_actions" to "service_role";

grant references on table "public"."moderation_actions" to "service_role";

grant select on table "public"."moderation_actions" to "service_role";

grant trigger on table "public"."moderation_actions" to "service_role";

grant truncate on table "public"."moderation_actions" to "service_role";

grant update on table "public"."moderation_actions" to "service_role";

grant delete on table "public"."moderation_cases" to "anon";

grant insert on table "public"."moderation_cases" to "anon";

grant references on table "public"."moderation_cases" to "anon";

grant select on table "public"."moderation_cases" to "anon";

grant trigger on table "public"."moderation_cases" to "anon";

grant truncate on table "public"."moderation_cases" to "anon";

grant update on table "public"."moderation_cases" to "anon";

grant delete on table "public"."moderation_cases" to "authenticated";

grant insert on table "public"."moderation_cases" to "authenticated";

grant references on table "public"."moderation_cases" to "authenticated";

grant select on table "public"."moderation_cases" to "authenticated";

grant trigger on table "public"."moderation_cases" to "authenticated";

grant truncate on table "public"."moderation_cases" to "authenticated";

grant update on table "public"."moderation_cases" to "authenticated";

grant delete on table "public"."moderation_cases" to "service_role";

grant insert on table "public"."moderation_cases" to "service_role";

grant references on table "public"."moderation_cases" to "service_role";

grant select on table "public"."moderation_cases" to "service_role";

grant trigger on table "public"."moderation_cases" to "service_role";

grant truncate on table "public"."moderation_cases" to "service_role";

grant update on table "public"."moderation_cases" to "service_role";

grant delete on table "public"."refund_events" to "anon";

grant insert on table "public"."refund_events" to "anon";

grant references on table "public"."refund_events" to "anon";

grant select on table "public"."refund_events" to "anon";

grant trigger on table "public"."refund_events" to "anon";

grant truncate on table "public"."refund_events" to "anon";

grant update on table "public"."refund_events" to "anon";

grant delete on table "public"."refund_events" to "authenticated";

grant insert on table "public"."refund_events" to "authenticated";

grant references on table "public"."refund_events" to "authenticated";

grant select on table "public"."refund_events" to "authenticated";

grant trigger on table "public"."refund_events" to "authenticated";

grant truncate on table "public"."refund_events" to "authenticated";

grant update on table "public"."refund_events" to "authenticated";

grant delete on table "public"."refund_events" to "service_role";

grant insert on table "public"."refund_events" to "service_role";

grant references on table "public"."refund_events" to "service_role";

grant select on table "public"."refund_events" to "service_role";

grant trigger on table "public"."refund_events" to "service_role";

grant truncate on table "public"."refund_events" to "service_role";

grant update on table "public"."refund_events" to "service_role";

grant delete on table "public"."refund_requests" to "anon";

grant insert on table "public"."refund_requests" to "anon";

grant references on table "public"."refund_requests" to "anon";

grant select on table "public"."refund_requests" to "anon";

grant trigger on table "public"."refund_requests" to "anon";

grant truncate on table "public"."refund_requests" to "anon";

grant update on table "public"."refund_requests" to "anon";

grant delete on table "public"."refund_requests" to "authenticated";

grant insert on table "public"."refund_requests" to "authenticated";

grant references on table "public"."refund_requests" to "authenticated";

grant select on table "public"."refund_requests" to "authenticated";

grant trigger on table "public"."refund_requests" to "authenticated";

grant truncate on table "public"."refund_requests" to "authenticated";

grant update on table "public"."refund_requests" to "authenticated";

grant delete on table "public"."refund_requests" to "service_role";

grant insert on table "public"."refund_requests" to "service_role";

grant references on table "public"."refund_requests" to "service_role";

grant select on table "public"."refund_requests" to "service_role";

grant trigger on table "public"."refund_requests" to "service_role";

grant truncate on table "public"."refund_requests" to "service_role";

grant update on table "public"."refund_requests" to "service_role";

grant delete on table "public"."reliability_events" to "anon";

grant insert on table "public"."reliability_events" to "anon";

grant references on table "public"."reliability_events" to "anon";

grant select on table "public"."reliability_events" to "anon";

grant trigger on table "public"."reliability_events" to "anon";

grant truncate on table "public"."reliability_events" to "anon";

grant update on table "public"."reliability_events" to "anon";

grant delete on table "public"."reliability_events" to "authenticated";

grant insert on table "public"."reliability_events" to "authenticated";

grant references on table "public"."reliability_events" to "authenticated";

grant select on table "public"."reliability_events" to "authenticated";

grant trigger on table "public"."reliability_events" to "authenticated";

grant truncate on table "public"."reliability_events" to "authenticated";

grant update on table "public"."reliability_events" to "authenticated";

grant delete on table "public"."reliability_events" to "service_role";

grant insert on table "public"."reliability_events" to "service_role";

grant references on table "public"."reliability_events" to "service_role";

grant select on table "public"."reliability_events" to "service_role";

grant trigger on table "public"."reliability_events" to "service_role";

grant truncate on table "public"."reliability_events" to "service_role";

grant update on table "public"."reliability_events" to "service_role";

grant delete on table "public"."support_ticket_events" to "anon";

grant insert on table "public"."support_ticket_events" to "anon";

grant references on table "public"."support_ticket_events" to "anon";

grant select on table "public"."support_ticket_events" to "anon";

grant trigger on table "public"."support_ticket_events" to "anon";

grant truncate on table "public"."support_ticket_events" to "anon";

grant update on table "public"."support_ticket_events" to "anon";

grant delete on table "public"."support_ticket_events" to "authenticated";

grant insert on table "public"."support_ticket_events" to "authenticated";

grant references on table "public"."support_ticket_events" to "authenticated";

grant select on table "public"."support_ticket_events" to "authenticated";

grant trigger on table "public"."support_ticket_events" to "authenticated";

grant truncate on table "public"."support_ticket_events" to "authenticated";

grant update on table "public"."support_ticket_events" to "authenticated";

grant delete on table "public"."support_ticket_events" to "service_role";

grant insert on table "public"."support_ticket_events" to "service_role";

grant references on table "public"."support_ticket_events" to "service_role";

grant select on table "public"."support_ticket_events" to "service_role";

grant trigger on table "public"."support_ticket_events" to "service_role";

grant truncate on table "public"."support_ticket_events" to "service_role";

grant update on table "public"."support_ticket_events" to "service_role";

grant delete on table "public"."support_ticket_messages" to "anon";

grant insert on table "public"."support_ticket_messages" to "anon";

grant references on table "public"."support_ticket_messages" to "anon";

grant select on table "public"."support_ticket_messages" to "anon";

grant trigger on table "public"."support_ticket_messages" to "anon";

grant truncate on table "public"."support_ticket_messages" to "anon";

grant update on table "public"."support_ticket_messages" to "anon";

grant delete on table "public"."support_ticket_messages" to "authenticated";

grant insert on table "public"."support_ticket_messages" to "authenticated";

grant references on table "public"."support_ticket_messages" to "authenticated";

grant select on table "public"."support_ticket_messages" to "authenticated";

grant trigger on table "public"."support_ticket_messages" to "authenticated";

grant truncate on table "public"."support_ticket_messages" to "authenticated";

grant update on table "public"."support_ticket_messages" to "authenticated";

grant delete on table "public"."support_ticket_messages" to "service_role";

grant insert on table "public"."support_ticket_messages" to "service_role";

grant references on table "public"."support_ticket_messages" to "service_role";

grant select on table "public"."support_ticket_messages" to "service_role";

grant trigger on table "public"."support_ticket_messages" to "service_role";

grant truncate on table "public"."support_ticket_messages" to "service_role";

grant update on table "public"."support_ticket_messages" to "service_role";

grant delete on table "public"."support_tickets" to "anon";

grant insert on table "public"."support_tickets" to "anon";

grant references on table "public"."support_tickets" to "anon";

grant select on table "public"."support_tickets" to "anon";

grant trigger on table "public"."support_tickets" to "anon";

grant truncate on table "public"."support_tickets" to "anon";

grant update on table "public"."support_tickets" to "anon";

grant delete on table "public"."support_tickets" to "authenticated";

grant insert on table "public"."support_tickets" to "authenticated";

grant references on table "public"."support_tickets" to "authenticated";

grant select on table "public"."support_tickets" to "authenticated";

grant trigger on table "public"."support_tickets" to "authenticated";

grant truncate on table "public"."support_tickets" to "authenticated";

grant update on table "public"."support_tickets" to "authenticated";

grant delete on table "public"."support_tickets" to "service_role";

grant insert on table "public"."support_tickets" to "service_role";

grant references on table "public"."support_tickets" to "service_role";

grant select on table "public"."support_tickets" to "service_role";

grant trigger on table "public"."support_tickets" to "service_role";

grant truncate on table "public"."support_tickets" to "service_role";

grant update on table "public"."support_tickets" to "service_role";

grant delete on table "public"."user_reports" to "anon";

grant insert on table "public"."user_reports" to "anon";

grant references on table "public"."user_reports" to "anon";

grant select on table "public"."user_reports" to "anon";

grant trigger on table "public"."user_reports" to "anon";

grant truncate on table "public"."user_reports" to "anon";

grant update on table "public"."user_reports" to "anon";

grant delete on table "public"."user_reports" to "authenticated";

grant insert on table "public"."user_reports" to "authenticated";

grant references on table "public"."user_reports" to "authenticated";

grant select on table "public"."user_reports" to "authenticated";

grant trigger on table "public"."user_reports" to "authenticated";

grant truncate on table "public"."user_reports" to "authenticated";

grant update on table "public"."user_reports" to "authenticated";

grant delete on table "public"."user_reports" to "service_role";

grant insert on table "public"."user_reports" to "service_role";

grant references on table "public"."user_reports" to "service_role";

grant select on table "public"."user_reports" to "service_role";

grant trigger on table "public"."user_reports" to "service_role";

grant truncate on table "public"."user_reports" to "service_role";

grant update on table "public"."user_reports" to "service_role";


  create policy "appeals_select_own"
  on "public"."appeals"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "billing_ledger_select_own"
  on "public"."billing_ledger"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "entitlement_events_select_own"
  on "public"."entitlement_events"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "invoice_events_select_own"
  on "public"."invoice_events"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "refund_events_select_own_request"
  on "public"."refund_events"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.refund_requests r
  WHERE ((r.id = refund_events.refund_request_id) AND (r.user_id = auth.uid())))));



  create policy "refund_requests_select_own"
  on "public"."refund_requests"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "reliability_events_select_own"
  on "public"."reliability_events"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "support_ticket_events_select_own_ticket"
  on "public"."support_ticket_events"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.support_tickets t
  WHERE ((t.id = support_ticket_events.ticket_id) AND (t.user_id = auth.uid())))));



  create policy "support_ticket_messages_select_own_ticket"
  on "public"."support_ticket_messages"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.support_tickets t
  WHERE ((t.id = support_ticket_messages.ticket_id) AND (t.user_id = auth.uid())))));



  create policy "support_tickets_select_own"
  on "public"."support_tickets"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "user_blocks_select_own"
  on "public"."user_blocks"
  as permissive
  for select
  to authenticated
using ((auth.uid() = blocker_user_id));



  create policy "user_reports_select_own"
  on "public"."user_reports"
  as permissive
  for select
  to authenticated
using ((auth.uid() = reporter_user_id));



