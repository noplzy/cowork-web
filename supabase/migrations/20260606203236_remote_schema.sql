
  create table "public"."notification_delivery_attempts" (
    "id" uuid not null default gen_random_uuid(),
    "notification_id" uuid,
    "channel" text not null,
    "status" text not null,
    "provider" text,
    "provider_message_id" text,
    "provider_payload" jsonb not null default '{}'::jsonb,
    "error_message" text,
    "attempted_at" timestamp with time zone not null default now(),
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."notification_delivery_attempts" enable row level security;


  create table "public"."notification_outbox" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "channel" text not null,
    "recipient" text,
    "template_key" text not null,
    "subject" text,
    "body" text not null,
    "status" text not null default 'queued'::text,
    "priority" text not null default 'normal'::text,
    "target_type" text,
    "target_id" text,
    "dedupe_key" text,
    "attempt_count" integer not null default 0,
    "next_attempt_at" timestamp with time zone not null default now(),
    "sent_at" timestamp with time zone,
    "read_at" timestamp with time zone,
    "dismissed_at" timestamp with time zone,
    "provider" text,
    "provider_message_id" text,
    "provider_payload" jsonb not null default '{}'::jsonb,
    "last_error" text,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."notification_outbox" enable row level security;


  create table "public"."notification_preferences" (
    "user_id" uuid not null,
    "in_app_enabled" boolean not null default true,
    "email_enabled" boolean not null default true,
    "sms_enabled" boolean not null default false,
    "line_enabled" boolean not null default false,
    "telegram_enabled" boolean not null default false,
    "support_updates" boolean not null default true,
    "billing_updates" boolean not null default true,
    "safety_updates" boolean not null default true,
    "room_updates" boolean not null default true,
    "marketing_updates" boolean not null default false,
    "quiet_hours_enabled" boolean not null default false,
    "quiet_hours_start" text,
    "quiet_hours_end" text,
    "locale" text not null default 'zh-TW'::text,
    "metadata" jsonb not null default '{}'::jsonb,
    "updated_at" timestamp with time zone not null default now(),
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."notification_preferences" enable row level security;


  create table "public"."notification_templates" (
    "id" uuid not null default gen_random_uuid(),
    "template_key" text not null,
    "category" text not null default 'system'::text,
    "channel" text not null default 'in_app'::text,
    "locale" text not null default 'zh-TW'::text,
    "subject_template" text,
    "body_template" text not null,
    "enabled" boolean not null default true,
    "required_variables" text[] not null default '{}'::text[],
    "metadata" jsonb not null default '{}'::jsonb,
    "updated_at" timestamp with time zone not null default now(),
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."notification_templates" enable row level security;


  create table "public"."ops_action_items" (
    "id" uuid not null default gen_random_uuid(),
    "source_type" text not null,
    "source_id" text,
    "title" text not null,
    "description" text,
    "category" text not null default 'general'::text,
    "severity" text not null default 'normal'::text,
    "status" text not null default 'open'::text,
    "assigned_admin_user_id" uuid,
    "due_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "resolved_by_admin_user_id" uuid,
    "resolution_note" text,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."ops_action_items" enable row level security;

CREATE INDEX idx_notification_delivery_attempts_notification ON public.notification_delivery_attempts USING btree (notification_id, attempted_at DESC);

CREATE UNIQUE INDEX idx_notification_outbox_dedupe ON public.notification_outbox USING btree (dedupe_key) WHERE (dedupe_key IS NOT NULL);

CREATE INDEX idx_notification_outbox_status_next ON public.notification_outbox USING btree (status, next_attempt_at, priority);

CREATE INDEX idx_notification_outbox_target ON public.notification_outbox USING btree (target_type, target_id, created_at DESC) WHERE ((target_type IS NOT NULL) AND (target_id IS NOT NULL));

CREATE INDEX idx_notification_outbox_user_created ON public.notification_outbox USING btree (user_id, created_at DESC) WHERE (user_id IS NOT NULL);

CREATE INDEX idx_notification_preferences_updated ON public.notification_preferences USING btree (updated_at DESC);

CREATE INDEX idx_notification_templates_category ON public.notification_templates USING btree (category, enabled);

CREATE INDEX idx_notification_templates_key_channel ON public.notification_templates USING btree (template_key, channel, locale);

CREATE INDEX idx_ops_action_items_assignee ON public.ops_action_items USING btree (assigned_admin_user_id, status, due_at) WHERE (assigned_admin_user_id IS NOT NULL);

CREATE INDEX idx_ops_action_items_source ON public.ops_action_items USING btree (source_type, source_id) WHERE (source_id IS NOT NULL);

CREATE INDEX idx_ops_action_items_status_severity ON public.ops_action_items USING btree (status, severity, created_at DESC);

CREATE UNIQUE INDEX notification_delivery_attempts_pkey ON public.notification_delivery_attempts USING btree (id);

CREATE UNIQUE INDEX notification_outbox_pkey ON public.notification_outbox USING btree (id);

CREATE UNIQUE INDEX notification_preferences_pkey ON public.notification_preferences USING btree (user_id);

CREATE UNIQUE INDEX notification_templates_pkey ON public.notification_templates USING btree (id);

CREATE UNIQUE INDEX notification_templates_template_key_key ON public.notification_templates USING btree (template_key);

CREATE UNIQUE INDEX ops_action_items_pkey ON public.ops_action_items USING btree (id);

alter table "public"."notification_delivery_attempts" add constraint "notification_delivery_attempts_pkey" PRIMARY KEY using index "notification_delivery_attempts_pkey";

alter table "public"."notification_outbox" add constraint "notification_outbox_pkey" PRIMARY KEY using index "notification_outbox_pkey";

alter table "public"."notification_preferences" add constraint "notification_preferences_pkey" PRIMARY KEY using index "notification_preferences_pkey";

alter table "public"."notification_templates" add constraint "notification_templates_pkey" PRIMARY KEY using index "notification_templates_pkey";

alter table "public"."ops_action_items" add constraint "ops_action_items_pkey" PRIMARY KEY using index "ops_action_items_pkey";

alter table "public"."notification_delivery_attempts" add constraint "notification_delivery_attempts_notification_id_fkey" FOREIGN KEY (notification_id) REFERENCES public.notification_outbox(id) ON DELETE CASCADE not valid;

alter table "public"."notification_delivery_attempts" validate constraint "notification_delivery_attempts_notification_id_fkey";

alter table "public"."notification_delivery_attempts" add constraint "notification_delivery_attempts_status_check" CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'manual_required'::text, 'cancelled'::text]))) not valid;

alter table "public"."notification_delivery_attempts" validate constraint "notification_delivery_attempts_status_check";

alter table "public"."notification_outbox" add constraint "notification_outbox_channel_check" CHECK ((channel = ANY (ARRAY['in_app'::text, 'email'::text, 'sms'::text, 'line'::text, 'telegram'::text, 'webhook'::text]))) not valid;

alter table "public"."notification_outbox" validate constraint "notification_outbox_channel_check";

alter table "public"."notification_outbox" add constraint "notification_outbox_priority_check" CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text]))) not valid;

alter table "public"."notification_outbox" validate constraint "notification_outbox_priority_check";

alter table "public"."notification_outbox" add constraint "notification_outbox_status_check" CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'sent'::text, 'read'::text, 'dismissed'::text, 'manual_required'::text, 'failed'::text, 'cancelled'::text]))) not valid;

alter table "public"."notification_outbox" validate constraint "notification_outbox_status_check";

alter table "public"."notification_outbox" add constraint "notification_outbox_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."notification_outbox" validate constraint "notification_outbox_user_id_fkey";

alter table "public"."notification_preferences" add constraint "notification_preferences_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."notification_preferences" validate constraint "notification_preferences_user_id_fkey";

alter table "public"."notification_templates" add constraint "notification_templates_category_check" CHECK ((category = ANY (ARRAY['support'::text, 'billing'::text, 'safety'::text, 'room'::text, 'ai'::text, 'system'::text, 'marketing'::text]))) not valid;

alter table "public"."notification_templates" validate constraint "notification_templates_category_check";

alter table "public"."notification_templates" add constraint "notification_templates_channel_check" CHECK ((channel = ANY (ARRAY['in_app'::text, 'email'::text, 'sms'::text, 'line'::text, 'telegram'::text, 'webhook'::text]))) not valid;

alter table "public"."notification_templates" validate constraint "notification_templates_channel_check";

alter table "public"."notification_templates" add constraint "notification_templates_template_key_key" UNIQUE using index "notification_templates_template_key_key";

alter table "public"."ops_action_items" add constraint "ops_action_items_assigned_admin_user_id_fkey" FOREIGN KEY (assigned_admin_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."ops_action_items" validate constraint "ops_action_items_assigned_admin_user_id_fkey";

alter table "public"."ops_action_items" add constraint "ops_action_items_resolved_by_admin_user_id_fkey" FOREIGN KEY (resolved_by_admin_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."ops_action_items" validate constraint "ops_action_items_resolved_by_admin_user_id_fkey";

alter table "public"."ops_action_items" add constraint "ops_action_items_severity_check" CHECK ((severity = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text, 'critical'::text]))) not valid;

alter table "public"."ops_action_items" validate constraint "ops_action_items_severity_check";

alter table "public"."ops_action_items" add constraint "ops_action_items_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'waiting'::text, 'resolved'::text, 'dismissed'::text, 'cancelled'::text]))) not valid;

alter table "public"."ops_action_items" validate constraint "ops_action_items_status_check";

grant delete on table "public"."notification_delivery_attempts" to "anon";

grant insert on table "public"."notification_delivery_attempts" to "anon";

grant references on table "public"."notification_delivery_attempts" to "anon";

grant select on table "public"."notification_delivery_attempts" to "anon";

grant trigger on table "public"."notification_delivery_attempts" to "anon";

grant truncate on table "public"."notification_delivery_attempts" to "anon";

grant update on table "public"."notification_delivery_attempts" to "anon";

grant delete on table "public"."notification_delivery_attempts" to "authenticated";

grant insert on table "public"."notification_delivery_attempts" to "authenticated";

grant references on table "public"."notification_delivery_attempts" to "authenticated";

grant select on table "public"."notification_delivery_attempts" to "authenticated";

grant trigger on table "public"."notification_delivery_attempts" to "authenticated";

grant truncate on table "public"."notification_delivery_attempts" to "authenticated";

grant update on table "public"."notification_delivery_attempts" to "authenticated";

grant delete on table "public"."notification_delivery_attempts" to "service_role";

grant insert on table "public"."notification_delivery_attempts" to "service_role";

grant references on table "public"."notification_delivery_attempts" to "service_role";

grant select on table "public"."notification_delivery_attempts" to "service_role";

grant trigger on table "public"."notification_delivery_attempts" to "service_role";

grant truncate on table "public"."notification_delivery_attempts" to "service_role";

grant update on table "public"."notification_delivery_attempts" to "service_role";

grant delete on table "public"."notification_outbox" to "anon";

grant insert on table "public"."notification_outbox" to "anon";

grant references on table "public"."notification_outbox" to "anon";

grant select on table "public"."notification_outbox" to "anon";

grant trigger on table "public"."notification_outbox" to "anon";

grant truncate on table "public"."notification_outbox" to "anon";

grant update on table "public"."notification_outbox" to "anon";

grant delete on table "public"."notification_outbox" to "authenticated";

grant insert on table "public"."notification_outbox" to "authenticated";

grant references on table "public"."notification_outbox" to "authenticated";

grant select on table "public"."notification_outbox" to "authenticated";

grant trigger on table "public"."notification_outbox" to "authenticated";

grant truncate on table "public"."notification_outbox" to "authenticated";

grant update on table "public"."notification_outbox" to "authenticated";

grant delete on table "public"."notification_outbox" to "service_role";

grant insert on table "public"."notification_outbox" to "service_role";

grant references on table "public"."notification_outbox" to "service_role";

grant select on table "public"."notification_outbox" to "service_role";

grant trigger on table "public"."notification_outbox" to "service_role";

grant truncate on table "public"."notification_outbox" to "service_role";

grant update on table "public"."notification_outbox" to "service_role";

grant delete on table "public"."notification_preferences" to "anon";

grant insert on table "public"."notification_preferences" to "anon";

grant references on table "public"."notification_preferences" to "anon";

grant select on table "public"."notification_preferences" to "anon";

grant trigger on table "public"."notification_preferences" to "anon";

grant truncate on table "public"."notification_preferences" to "anon";

grant update on table "public"."notification_preferences" to "anon";

grant delete on table "public"."notification_preferences" to "authenticated";

grant insert on table "public"."notification_preferences" to "authenticated";

grant references on table "public"."notification_preferences" to "authenticated";

grant select on table "public"."notification_preferences" to "authenticated";

grant trigger on table "public"."notification_preferences" to "authenticated";

grant truncate on table "public"."notification_preferences" to "authenticated";

grant update on table "public"."notification_preferences" to "authenticated";

grant delete on table "public"."notification_preferences" to "service_role";

grant insert on table "public"."notification_preferences" to "service_role";

grant references on table "public"."notification_preferences" to "service_role";

grant select on table "public"."notification_preferences" to "service_role";

grant trigger on table "public"."notification_preferences" to "service_role";

grant truncate on table "public"."notification_preferences" to "service_role";

grant update on table "public"."notification_preferences" to "service_role";

grant delete on table "public"."notification_templates" to "anon";

grant insert on table "public"."notification_templates" to "anon";

grant references on table "public"."notification_templates" to "anon";

grant select on table "public"."notification_templates" to "anon";

grant trigger on table "public"."notification_templates" to "anon";

grant truncate on table "public"."notification_templates" to "anon";

grant update on table "public"."notification_templates" to "anon";

grant delete on table "public"."notification_templates" to "authenticated";

grant insert on table "public"."notification_templates" to "authenticated";

grant references on table "public"."notification_templates" to "authenticated";

grant select on table "public"."notification_templates" to "authenticated";

grant trigger on table "public"."notification_templates" to "authenticated";

grant truncate on table "public"."notification_templates" to "authenticated";

grant update on table "public"."notification_templates" to "authenticated";

grant delete on table "public"."notification_templates" to "service_role";

grant insert on table "public"."notification_templates" to "service_role";

grant references on table "public"."notification_templates" to "service_role";

grant select on table "public"."notification_templates" to "service_role";

grant trigger on table "public"."notification_templates" to "service_role";

grant truncate on table "public"."notification_templates" to "service_role";

grant update on table "public"."notification_templates" to "service_role";

grant delete on table "public"."ops_action_items" to "anon";

grant insert on table "public"."ops_action_items" to "anon";

grant references on table "public"."ops_action_items" to "anon";

grant select on table "public"."ops_action_items" to "anon";

grant trigger on table "public"."ops_action_items" to "anon";

grant truncate on table "public"."ops_action_items" to "anon";

grant update on table "public"."ops_action_items" to "anon";

grant delete on table "public"."ops_action_items" to "authenticated";

grant insert on table "public"."ops_action_items" to "authenticated";

grant references on table "public"."ops_action_items" to "authenticated";

grant select on table "public"."ops_action_items" to "authenticated";

grant trigger on table "public"."ops_action_items" to "authenticated";

grant truncate on table "public"."ops_action_items" to "authenticated";

grant update on table "public"."ops_action_items" to "authenticated";

grant delete on table "public"."ops_action_items" to "service_role";

grant insert on table "public"."ops_action_items" to "service_role";

grant references on table "public"."ops_action_items" to "service_role";

grant select on table "public"."ops_action_items" to "service_role";

grant trigger on table "public"."ops_action_items" to "service_role";

grant truncate on table "public"."ops_action_items" to "service_role";

grant update on table "public"."ops_action_items" to "service_role";


  create policy "notification_outbox_select_own"
  on "public"."notification_outbox"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "notification_preferences_insert_own"
  on "public"."notification_preferences"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "notification_preferences_select_own"
  on "public"."notification_preferences"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "notification_preferences_update_own"
  on "public"."notification_preferences"
  as permissive
  for update
  to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



