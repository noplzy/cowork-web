alter table "public"."payment_orders" drop constraint "payment_orders_plan_code_check";

alter table "public"."payment_orders" drop constraint "payment_orders_provider_check";


  create table "public"."ecpay_invoice_tasks" (
    "id" uuid not null default gen_random_uuid(),
    "invoice_event_id" uuid,
    "payment_order_id" uuid,
    "user_id" uuid,
    "status" text not null default 'queued'::text,
    "attempt_count" integer not null default 0,
    "next_attempt_at" timestamp with time zone not null default now(),
    "provider_invoice_no" text,
    "provider_random_number" text,
    "provider_payload" jsonb not null default '{}'::jsonb,
    "last_error" text,
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "refund_request_id" uuid,
    "action_type" text not null default 'issue'::text,
    "provider_task_id" text
      );


alter table "public"."ecpay_invoice_tasks" enable row level security;


  create table "public"."ecpay_refund_tasks" (
    "id" uuid not null default gen_random_uuid(),
    "refund_request_id" uuid,
    "payment_order_id" uuid,
    "user_id" uuid,
    "status" text not null default 'queued'::text,
    "attempt_count" integer not null default 0,
    "next_attempt_at" timestamp with time zone not null default now(),
    "provider_refund_id" text,
    "provider_payload" jsonb not null default '{}'::jsonb,
    "last_error" text,
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "provider_task_id" text
      );


alter table "public"."ecpay_refund_tasks" enable row level security;

alter table "public"."user_blocks" add column "id" uuid default gen_random_uuid();

CREATE UNIQUE INDEX ecpay_invoice_tasks_pkey ON public.ecpay_invoice_tasks USING btree (id);

CREATE UNIQUE INDEX ecpay_refund_tasks_pkey ON public.ecpay_refund_tasks USING btree (id);

CREATE INDEX idx_ecpay_invoice_tasks_invoice_event_action ON public.ecpay_invoice_tasks USING btree (invoice_event_id, action_type, created_at DESC) WHERE (invoice_event_id IS NOT NULL);

CREATE UNIQUE INDEX idx_ecpay_invoice_tasks_invoice_event_unique ON public.ecpay_invoice_tasks USING btree (invoice_event_id) WHERE (invoice_event_id IS NOT NULL);

CREATE INDEX idx_ecpay_invoice_tasks_payment_order_action ON public.ecpay_invoice_tasks USING btree (payment_order_id, action_type, created_at DESC) WHERE (payment_order_id IS NOT NULL);

CREATE INDEX idx_ecpay_invoice_tasks_payment_status_created ON public.ecpay_invoice_tasks USING btree (payment_order_id, status, created_at DESC) WHERE (payment_order_id IS NOT NULL);

CREATE INDEX idx_ecpay_invoice_tasks_refund_request ON public.ecpay_invoice_tasks USING btree (refund_request_id, created_at DESC) WHERE (refund_request_id IS NOT NULL);

CREATE INDEX idx_ecpay_invoice_tasks_status_created ON public.ecpay_invoice_tasks USING btree (status, created_at DESC);

CREATE INDEX idx_ecpay_invoice_tasks_status_next ON public.ecpay_invoice_tasks USING btree (status, next_attempt_at, created_at DESC);

CREATE INDEX idx_ecpay_refund_tasks_payment_order ON public.ecpay_refund_tasks USING btree (payment_order_id, created_at DESC) WHERE (payment_order_id IS NOT NULL);

CREATE INDEX idx_ecpay_refund_tasks_payment_status_created ON public.ecpay_refund_tasks USING btree (payment_order_id, status, created_at DESC) WHERE (payment_order_id IS NOT NULL);

CREATE INDEX idx_ecpay_refund_tasks_refund_request ON public.ecpay_refund_tasks USING btree (refund_request_id, created_at DESC) WHERE (refund_request_id IS NOT NULL);

CREATE UNIQUE INDEX idx_ecpay_refund_tasks_refund_request_unique ON public.ecpay_refund_tasks USING btree (refund_request_id) WHERE (refund_request_id IS NOT NULL);

CREATE INDEX idx_ecpay_refund_tasks_status_created ON public.ecpay_refund_tasks USING btree (status, created_at DESC);

CREATE INDEX idx_ecpay_refund_tasks_status_next ON public.ecpay_refund_tasks USING btree (status, next_attempt_at, created_at DESC);

CREATE INDEX idx_invoice_events_order_event_created ON public.invoice_events USING btree (payment_order_id, event_type, created_at DESC) WHERE (payment_order_id IS NOT NULL);

CREATE INDEX idx_invoice_events_payment_order_event_created ON public.invoice_events USING btree (payment_order_id, event_type, created_at DESC) WHERE (payment_order_id IS NOT NULL);

CREATE INDEX idx_payment_events_merchant_event_created ON public.payment_events USING btree (merchant_trade_no, event_type, created_at DESC) WHERE (merchant_trade_no IS NOT NULL);

CREATE INDEX idx_refund_requests_order_status_created ON public.refund_requests USING btree (payment_order_id, status, created_at DESC) WHERE (payment_order_id IS NOT NULL);

CREATE INDEX idx_subscription_events_profile_event_created ON public.subscription_events USING btree (subscription_profile_id, event_type, created_at DESC) WHERE (subscription_profile_id IS NOT NULL);

CREATE INDEX idx_subscription_profiles_status_created ON public.subscription_profiles USING btree (status, created_at DESC);

CREATE UNIQUE INDEX user_blocks_id_unique ON public.user_blocks USING btree (id);

CREATE UNIQUE INDEX user_blocks_relationship_unique ON public.user_blocks USING btree (blocker_user_id, blocked_user_id);

alter table "public"."ecpay_invoice_tasks" add constraint "ecpay_invoice_tasks_pkey" PRIMARY KEY using index "ecpay_invoice_tasks_pkey";

alter table "public"."ecpay_refund_tasks" add constraint "ecpay_refund_tasks_pkey" PRIMARY KEY using index "ecpay_refund_tasks_pkey";

alter table "public"."ecpay_invoice_tasks" add constraint "ecpay_invoice_tasks_invoice_event_id_fkey" FOREIGN KEY (invoice_event_id) REFERENCES public.invoice_events(id) ON DELETE SET NULL not valid;

alter table "public"."ecpay_invoice_tasks" validate constraint "ecpay_invoice_tasks_invoice_event_id_fkey";

alter table "public"."ecpay_invoice_tasks" add constraint "ecpay_invoice_tasks_payment_order_id_fkey" FOREIGN KEY (payment_order_id) REFERENCES public.payment_orders(id) ON DELETE SET NULL not valid;

alter table "public"."ecpay_invoice_tasks" validate constraint "ecpay_invoice_tasks_payment_order_id_fkey";

alter table "public"."ecpay_invoice_tasks" add constraint "ecpay_invoice_tasks_status_check" CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'issued'::text, 'manual_required'::text, 'failed'::text, 'cancelled'::text]))) not valid;

alter table "public"."ecpay_invoice_tasks" validate constraint "ecpay_invoice_tasks_status_check";

alter table "public"."ecpay_refund_tasks" add constraint "ecpay_refund_tasks_payment_order_id_fkey" FOREIGN KEY (payment_order_id) REFERENCES public.payment_orders(id) ON DELETE SET NULL not valid;

alter table "public"."ecpay_refund_tasks" validate constraint "ecpay_refund_tasks_payment_order_id_fkey";

alter table "public"."ecpay_refund_tasks" add constraint "ecpay_refund_tasks_refund_request_id_fkey" FOREIGN KEY (refund_request_id) REFERENCES public.refund_requests(id) ON DELETE SET NULL not valid;

alter table "public"."ecpay_refund_tasks" validate constraint "ecpay_refund_tasks_refund_request_id_fkey";

alter table "public"."ecpay_refund_tasks" add constraint "ecpay_refund_tasks_status_check" CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'refunded'::text, 'manual_required'::text, 'failed'::text, 'cancelled'::text]))) not valid;

alter table "public"."ecpay_refund_tasks" validate constraint "ecpay_refund_tasks_status_check";

alter table "public"."payment_orders" add constraint "payment_orders_plan_code_check" CHECK ((plan_code = ANY (ARRAY['vip_month'::text, 'companion_basic_299'::text, 'companion_regular_599'::text, 'host_islander_1299'::text]))) not valid;

alter table "public"."payment_orders" validate constraint "payment_orders_plan_code_check";

alter table "public"."payment_orders" add constraint "payment_orders_provider_check" CHECK ((provider = ANY (ARRAY['ecpay'::text, 'ecpay_recurring'::text, 'internal'::text]))) not valid;

alter table "public"."payment_orders" validate constraint "payment_orders_provider_check";

grant delete on table "public"."ecpay_invoice_tasks" to "anon";

grant insert on table "public"."ecpay_invoice_tasks" to "anon";

grant references on table "public"."ecpay_invoice_tasks" to "anon";

grant select on table "public"."ecpay_invoice_tasks" to "anon";

grant trigger on table "public"."ecpay_invoice_tasks" to "anon";

grant truncate on table "public"."ecpay_invoice_tasks" to "anon";

grant update on table "public"."ecpay_invoice_tasks" to "anon";

grant delete on table "public"."ecpay_invoice_tasks" to "authenticated";

grant insert on table "public"."ecpay_invoice_tasks" to "authenticated";

grant references on table "public"."ecpay_invoice_tasks" to "authenticated";

grant select on table "public"."ecpay_invoice_tasks" to "authenticated";

grant trigger on table "public"."ecpay_invoice_tasks" to "authenticated";

grant truncate on table "public"."ecpay_invoice_tasks" to "authenticated";

grant update on table "public"."ecpay_invoice_tasks" to "authenticated";

grant delete on table "public"."ecpay_invoice_tasks" to "service_role";

grant insert on table "public"."ecpay_invoice_tasks" to "service_role";

grant references on table "public"."ecpay_invoice_tasks" to "service_role";

grant select on table "public"."ecpay_invoice_tasks" to "service_role";

grant trigger on table "public"."ecpay_invoice_tasks" to "service_role";

grant truncate on table "public"."ecpay_invoice_tasks" to "service_role";

grant update on table "public"."ecpay_invoice_tasks" to "service_role";

grant delete on table "public"."ecpay_refund_tasks" to "anon";

grant insert on table "public"."ecpay_refund_tasks" to "anon";

grant references on table "public"."ecpay_refund_tasks" to "anon";

grant select on table "public"."ecpay_refund_tasks" to "anon";

grant trigger on table "public"."ecpay_refund_tasks" to "anon";

grant truncate on table "public"."ecpay_refund_tasks" to "anon";

grant update on table "public"."ecpay_refund_tasks" to "anon";

grant delete on table "public"."ecpay_refund_tasks" to "authenticated";

grant insert on table "public"."ecpay_refund_tasks" to "authenticated";

grant references on table "public"."ecpay_refund_tasks" to "authenticated";

grant select on table "public"."ecpay_refund_tasks" to "authenticated";

grant trigger on table "public"."ecpay_refund_tasks" to "authenticated";

grant truncate on table "public"."ecpay_refund_tasks" to "authenticated";

grant update on table "public"."ecpay_refund_tasks" to "authenticated";

grant delete on table "public"."ecpay_refund_tasks" to "service_role";

grant insert on table "public"."ecpay_refund_tasks" to "service_role";

grant references on table "public"."ecpay_refund_tasks" to "service_role";

grant select on table "public"."ecpay_refund_tasks" to "service_role";

grant trigger on table "public"."ecpay_refund_tasks" to "service_role";

grant truncate on table "public"."ecpay_refund_tasks" to "service_role";

grant update on table "public"."ecpay_refund_tasks" to "service_role";


