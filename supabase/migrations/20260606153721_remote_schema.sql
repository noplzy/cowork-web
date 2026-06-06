
  create table "public"."admin_entity_notes" (
    "id" uuid not null default gen_random_uuid(),
    "target_type" text not null,
    "target_id" text not null,
    "admin_user_id" uuid,
    "body" text not null,
    "pinned" boolean not null default false,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."admin_entity_notes" enable row level security;


  create table "public"."ecpay_subscription_tasks" (
    "id" uuid not null default gen_random_uuid(),
    "subscription_profile_id" uuid,
    "user_id" uuid,
    "action_type" text not null,
    "status" text not null default 'queued'::text,
    "attempt_count" integer not null default 0,
    "next_attempt_at" timestamp with time zone not null default now(),
    "provider_task_id" text,
    "provider_payload" jsonb not null default '{}'::jsonb,
    "last_error" text,
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."ecpay_subscription_tasks" enable row level security;


  create table "public"."subscription_events" (
    "id" uuid not null default gen_random_uuid(),
    "subscription_profile_id" uuid,
    "user_id" uuid,
    "event_type" text not null,
    "merchant_trade_no" text,
    "payment_order_id" uuid,
    "provider_payload" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."subscription_events" enable row level security;


  create table "public"."subscription_profiles" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "provider" text not null default 'ecpay'::text,
    "plan_code" text not null,
    "status" text not null default 'pending'::text,
    "merchant_member_id" text,
    "merchant_trade_no" text,
    "provider_profile_id" text,
    "period_amount" integer not null default 0,
    "period_type" text not null default 'M'::text,
    "frequency" integer not null default 1,
    "exec_times" integer not null default 999,
    "auto_renew" boolean not null default true,
    "next_charge_at" timestamp with time zone,
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "cancel_reason" text,
    "raw_payload" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "cancel_requested_at" timestamp with time zone,
    "cancel_requested_by_user_id" uuid,
    "last_provider_error" text,
    "admin_note" text
      );


alter table "public"."subscription_profiles" enable row level security;

CREATE UNIQUE INDEX admin_entity_notes_pkey ON public.admin_entity_notes USING btree (id);

CREATE UNIQUE INDEX ecpay_subscription_tasks_pkey ON public.ecpay_subscription_tasks USING btree (id);

CREATE INDEX idx_admin_entity_notes_admin ON public.admin_entity_notes USING btree (admin_user_id, created_at DESC) WHERE (admin_user_id IS NOT NULL);

CREATE INDEX idx_admin_entity_notes_target ON public.admin_entity_notes USING btree (target_type, target_id, pinned DESC, created_at DESC);

CREATE INDEX idx_subscription_events_profile_created ON public.subscription_events USING btree (subscription_profile_id, created_at DESC);

CREATE INDEX idx_subscription_profiles_status_next ON public.subscription_profiles USING btree (status, next_charge_at);

CREATE INDEX idx_subscription_profiles_user_created ON public.subscription_profiles USING btree (user_id, created_at DESC);

CREATE INDEX idx_subscription_tasks_profile_created ON public.ecpay_subscription_tasks USING btree (subscription_profile_id, created_at DESC) WHERE (subscription_profile_id IS NOT NULL);

CREATE INDEX idx_subscription_tasks_status_next ON public.ecpay_subscription_tasks USING btree (status, next_attempt_at);

CREATE UNIQUE INDEX subscription_events_pkey ON public.subscription_events USING btree (id);

CREATE UNIQUE INDEX subscription_profiles_pkey ON public.subscription_profiles USING btree (id);

alter table "public"."admin_entity_notes" add constraint "admin_entity_notes_pkey" PRIMARY KEY using index "admin_entity_notes_pkey";

alter table "public"."ecpay_subscription_tasks" add constraint "ecpay_subscription_tasks_pkey" PRIMARY KEY using index "ecpay_subscription_tasks_pkey";

alter table "public"."subscription_events" add constraint "subscription_events_pkey" PRIMARY KEY using index "subscription_events_pkey";

alter table "public"."subscription_profiles" add constraint "subscription_profiles_pkey" PRIMARY KEY using index "subscription_profiles_pkey";

alter table "public"."admin_entity_notes" add constraint "admin_entity_notes_admin_user_id_fkey" FOREIGN KEY (admin_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."admin_entity_notes" validate constraint "admin_entity_notes_admin_user_id_fkey";

alter table "public"."admin_entity_notes" add constraint "admin_entity_notes_target_type_check" CHECK ((target_type = ANY (ARRAY['user'::text, 'room'::text, 'payment_order'::text, 'subscription'::text, 'refund_request'::text, 'support_ticket'::text, 'moderation_case'::text, 'host_credit'::text]))) not valid;

alter table "public"."admin_entity_notes" validate constraint "admin_entity_notes_target_type_check";

alter table "public"."ecpay_subscription_tasks" add constraint "ecpay_subscription_tasks_action_check" CHECK ((action_type = ANY (ARRAY['create_profile'::text, 'cancel_profile'::text, 'verify_profile'::text, 'manual_note'::text]))) not valid;

alter table "public"."ecpay_subscription_tasks" validate constraint "ecpay_subscription_tasks_action_check";

alter table "public"."ecpay_subscription_tasks" add constraint "ecpay_subscription_tasks_status_check" CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'submitted'::text, 'completed'::text, 'manual_required'::text, 'failed'::text, 'cancelled'::text]))) not valid;

alter table "public"."ecpay_subscription_tasks" validate constraint "ecpay_subscription_tasks_status_check";

alter table "public"."ecpay_subscription_tasks" add constraint "ecpay_subscription_tasks_subscription_profile_id_fkey" FOREIGN KEY (subscription_profile_id) REFERENCES public.subscription_profiles(id) ON DELETE SET NULL not valid;

alter table "public"."ecpay_subscription_tasks" validate constraint "ecpay_subscription_tasks_subscription_profile_id_fkey";

alter table "public"."ecpay_subscription_tasks" add constraint "ecpay_subscription_tasks_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."ecpay_subscription_tasks" validate constraint "ecpay_subscription_tasks_user_id_fkey";

alter table "public"."subscription_events" add constraint "subscription_events_payment_order_id_fkey" FOREIGN KEY (payment_order_id) REFERENCES public.payment_orders(id) ON DELETE SET NULL not valid;

alter table "public"."subscription_events" validate constraint "subscription_events_payment_order_id_fkey";

alter table "public"."subscription_events" add constraint "subscription_events_subscription_profile_id_fkey" FOREIGN KEY (subscription_profile_id) REFERENCES public.subscription_profiles(id) ON DELETE CASCADE not valid;

alter table "public"."subscription_events" validate constraint "subscription_events_subscription_profile_id_fkey";

alter table "public"."subscription_events" add constraint "subscription_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."subscription_events" validate constraint "subscription_events_user_id_fkey";

alter table "public"."subscription_profiles" add constraint "subscription_profiles_amount_check" CHECK ((period_amount >= 0)) not valid;

alter table "public"."subscription_profiles" validate constraint "subscription_profiles_amount_check";

alter table "public"."subscription_profiles" add constraint "subscription_profiles_cancel_requested_by_user_id_fkey" FOREIGN KEY (cancel_requested_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."subscription_profiles" validate constraint "subscription_profiles_cancel_requested_by_user_id_fkey";

alter table "public"."subscription_profiles" add constraint "subscription_profiles_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'past_due'::text, 'cancel_pending'::text, 'cancelled'::text, 'expired'::text, 'failed'::text]))) not valid;

alter table "public"."subscription_profiles" validate constraint "subscription_profiles_status_check";

alter table "public"."subscription_profiles" add constraint "subscription_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."subscription_profiles" validate constraint "subscription_profiles_user_id_fkey";

grant delete on table "public"."admin_entity_notes" to "anon";

grant insert on table "public"."admin_entity_notes" to "anon";

grant references on table "public"."admin_entity_notes" to "anon";

grant select on table "public"."admin_entity_notes" to "anon";

grant trigger on table "public"."admin_entity_notes" to "anon";

grant truncate on table "public"."admin_entity_notes" to "anon";

grant update on table "public"."admin_entity_notes" to "anon";

grant delete on table "public"."admin_entity_notes" to "authenticated";

grant insert on table "public"."admin_entity_notes" to "authenticated";

grant references on table "public"."admin_entity_notes" to "authenticated";

grant select on table "public"."admin_entity_notes" to "authenticated";

grant trigger on table "public"."admin_entity_notes" to "authenticated";

grant truncate on table "public"."admin_entity_notes" to "authenticated";

grant update on table "public"."admin_entity_notes" to "authenticated";

grant delete on table "public"."admin_entity_notes" to "service_role";

grant insert on table "public"."admin_entity_notes" to "service_role";

grant references on table "public"."admin_entity_notes" to "service_role";

grant select on table "public"."admin_entity_notes" to "service_role";

grant trigger on table "public"."admin_entity_notes" to "service_role";

grant truncate on table "public"."admin_entity_notes" to "service_role";

grant update on table "public"."admin_entity_notes" to "service_role";

grant delete on table "public"."ecpay_subscription_tasks" to "anon";

grant insert on table "public"."ecpay_subscription_tasks" to "anon";

grant references on table "public"."ecpay_subscription_tasks" to "anon";

grant select on table "public"."ecpay_subscription_tasks" to "anon";

grant trigger on table "public"."ecpay_subscription_tasks" to "anon";

grant truncate on table "public"."ecpay_subscription_tasks" to "anon";

grant update on table "public"."ecpay_subscription_tasks" to "anon";

grant delete on table "public"."ecpay_subscription_tasks" to "authenticated";

grant insert on table "public"."ecpay_subscription_tasks" to "authenticated";

grant references on table "public"."ecpay_subscription_tasks" to "authenticated";

grant select on table "public"."ecpay_subscription_tasks" to "authenticated";

grant trigger on table "public"."ecpay_subscription_tasks" to "authenticated";

grant truncate on table "public"."ecpay_subscription_tasks" to "authenticated";

grant update on table "public"."ecpay_subscription_tasks" to "authenticated";

grant delete on table "public"."ecpay_subscription_tasks" to "service_role";

grant insert on table "public"."ecpay_subscription_tasks" to "service_role";

grant references on table "public"."ecpay_subscription_tasks" to "service_role";

grant select on table "public"."ecpay_subscription_tasks" to "service_role";

grant trigger on table "public"."ecpay_subscription_tasks" to "service_role";

grant truncate on table "public"."ecpay_subscription_tasks" to "service_role";

grant update on table "public"."ecpay_subscription_tasks" to "service_role";

grant delete on table "public"."subscription_events" to "anon";

grant insert on table "public"."subscription_events" to "anon";

grant references on table "public"."subscription_events" to "anon";

grant select on table "public"."subscription_events" to "anon";

grant trigger on table "public"."subscription_events" to "anon";

grant truncate on table "public"."subscription_events" to "anon";

grant update on table "public"."subscription_events" to "anon";

grant delete on table "public"."subscription_events" to "authenticated";

grant insert on table "public"."subscription_events" to "authenticated";

grant references on table "public"."subscription_events" to "authenticated";

grant select on table "public"."subscription_events" to "authenticated";

grant trigger on table "public"."subscription_events" to "authenticated";

grant truncate on table "public"."subscription_events" to "authenticated";

grant update on table "public"."subscription_events" to "authenticated";

grant delete on table "public"."subscription_events" to "service_role";

grant insert on table "public"."subscription_events" to "service_role";

grant references on table "public"."subscription_events" to "service_role";

grant select on table "public"."subscription_events" to "service_role";

grant trigger on table "public"."subscription_events" to "service_role";

grant truncate on table "public"."subscription_events" to "service_role";

grant update on table "public"."subscription_events" to "service_role";

grant delete on table "public"."subscription_profiles" to "anon";

grant insert on table "public"."subscription_profiles" to "anon";

grant references on table "public"."subscription_profiles" to "anon";

grant select on table "public"."subscription_profiles" to "anon";

grant trigger on table "public"."subscription_profiles" to "anon";

grant truncate on table "public"."subscription_profiles" to "anon";

grant update on table "public"."subscription_profiles" to "anon";

grant delete on table "public"."subscription_profiles" to "authenticated";

grant insert on table "public"."subscription_profiles" to "authenticated";

grant references on table "public"."subscription_profiles" to "authenticated";

grant select on table "public"."subscription_profiles" to "authenticated";

grant trigger on table "public"."subscription_profiles" to "authenticated";

grant truncate on table "public"."subscription_profiles" to "authenticated";

grant update on table "public"."subscription_profiles" to "authenticated";

grant delete on table "public"."subscription_profiles" to "service_role";

grant insert on table "public"."subscription_profiles" to "service_role";

grant references on table "public"."subscription_profiles" to "service_role";

grant select on table "public"."subscription_profiles" to "service_role";

grant trigger on table "public"."subscription_profiles" to "service_role";

grant truncate on table "public"."subscription_profiles" to "service_role";

grant update on table "public"."subscription_profiles" to "service_role";


  create policy "subscription_events_select_own"
  on "public"."subscription_events"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "subscription_profiles_select_own"
  on "public"."subscription_profiles"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



