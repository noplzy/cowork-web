
  create table "public"."auth_sms_attempts" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "user_id" uuid,
    "phone" text not null,
    "otp_flow" text not null default 'unknown'::text,
    "provider" text not null,
    "status" text not null,
    "provider_message_id" text,
    "error_code" text,
    "error_message" text,
    "metadata" jsonb not null default '{}'::jsonb
      );


alter table "public"."auth_sms_attempts" enable row level security;

CREATE INDEX auth_sms_attempts_created_at_idx ON public.auth_sms_attempts USING btree (created_at DESC);

CREATE INDEX auth_sms_attempts_phone_idx ON public.auth_sms_attempts USING btree (phone, created_at DESC);

CREATE UNIQUE INDEX auth_sms_attempts_pkey ON public.auth_sms_attempts USING btree (id);

CREATE INDEX auth_sms_attempts_user_id_idx ON public.auth_sms_attempts USING btree (user_id, created_at DESC);

alter table "public"."auth_sms_attempts" add constraint "auth_sms_attempts_pkey" PRIMARY KEY using index "auth_sms_attempts_pkey";

alter table "public"."auth_sms_attempts" add constraint "auth_sms_attempts_status_check" CHECK ((status = ANY (ARRAY['sent'::text, 'failed'::text, 'skipped'::text]))) not valid;

alter table "public"."auth_sms_attempts" validate constraint "auth_sms_attempts_status_check";

grant delete on table "public"."auth_sms_attempts" to "anon";

grant insert on table "public"."auth_sms_attempts" to "anon";

grant references on table "public"."auth_sms_attempts" to "anon";

grant select on table "public"."auth_sms_attempts" to "anon";

grant trigger on table "public"."auth_sms_attempts" to "anon";

grant truncate on table "public"."auth_sms_attempts" to "anon";

grant update on table "public"."auth_sms_attempts" to "anon";

grant delete on table "public"."auth_sms_attempts" to "authenticated";

grant insert on table "public"."auth_sms_attempts" to "authenticated";

grant references on table "public"."auth_sms_attempts" to "authenticated";

grant select on table "public"."auth_sms_attempts" to "authenticated";

grant trigger on table "public"."auth_sms_attempts" to "authenticated";

grant truncate on table "public"."auth_sms_attempts" to "authenticated";

grant update on table "public"."auth_sms_attempts" to "authenticated";

grant delete on table "public"."auth_sms_attempts" to "service_role";

grant insert on table "public"."auth_sms_attempts" to "service_role";

grant references on table "public"."auth_sms_attempts" to "service_role";

grant select on table "public"."auth_sms_attempts" to "service_role";

grant trigger on table "public"."auth_sms_attempts" to "service_role";

grant truncate on table "public"."auth_sms_attempts" to "service_role";

grant update on table "public"."auth_sms_attempts" to "service_role";


  create policy "auth_sms_attempts_service_role_only"
  on "public"."auth_sms_attempts"
  as permissive
  for all
  to public
using (false)
with check (false);



