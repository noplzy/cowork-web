
  create table "public"."admin_permission_presets" (
    "role_key" text not null,
    "display_name" text not null,
    "description" text not null,
    "permissions" text[] not null default '{}'::text[],
    "is_system" boolean not null default true,
    "updated_at" timestamp with time zone not null default now(),
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."admin_permission_presets" enable row level security;


  create table "public"."admin_role_assignments" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "role_key" text not null default 'ops'::text,
    "permissions" text[] not null default '{}'::text[],
    "status" text not null default 'active'::text,
    "granted_by_admin_user_id" uuid,
    "revoked_by_admin_user_id" uuid,
    "note" text,
    "metadata" jsonb not null default '{}'::jsonb,
    "granted_at" timestamp with time zone not null default now(),
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."admin_role_assignments" enable row level security;


  create table "public"."buddy_booking_events" (
    "id" uuid not null default gen_random_uuid(),
    "booking_id" uuid,
    "actor_user_id" uuid,
    "event_type" text not null,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."buddy_booking_events" enable row level security;


  create table "public"."buddy_disputes" (
    "id" uuid not null default gen_random_uuid(),
    "booking_id" uuid,
    "service_id" uuid,
    "opened_by_user_id" uuid,
    "counterparty_user_id" uuid,
    "dispute_status" text not null default 'open'::text,
    "reason_category" text not null default 'other'::text,
    "description" text not null,
    "admin_user_id" uuid,
    "admin_note" text,
    "resolved_at" timestamp with time zone,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."buddy_disputes" enable row level security;


  create table "public"."buddy_provider_applications" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "application_status" text not null default 'draft'::text,
    "display_title" text,
    "experience_summary" text,
    "service_boundaries" text,
    "identity_request_id" uuid,
    "reviewer_user_id" uuid,
    "reviewer_note" text,
    "submitted_at" timestamp with time zone,
    "reviewed_at" timestamp with time zone,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."buddy_provider_applications" enable row level security;


  create table "public"."identity_verification_requests" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "request_type" text not null default 'manual_review'::text,
    "legal_name" text,
    "birth_year" integer,
    "document_type" text,
    "document_last4" text,
    "review_status" text not null default 'pending'::text,
    "reviewer_user_id" uuid,
    "reviewer_note" text,
    "user_note" text,
    "submitted_at" timestamp with time zone not null default now(),
    "reviewed_at" timestamp with time zone,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."identity_verification_requests" enable row level security;


  create table "public"."user_identity_bindings" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "binding_type" text not null,
    "binding_value_masked" text,
    "status" text not null default 'pending'::text,
    "verified_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "source" text not null default 'account'::text,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."user_identity_bindings" enable row level security;

alter table "public"."buddy_bookings" add column "accepted_at" timestamp with time zone;

alter table "public"."buddy_bookings" add column "buyer_completed_at" timestamp with time zone;

alter table "public"."buddy_bookings" add column "cancelled_at" timestamp with time zone;

alter table "public"."buddy_bookings" add column "completed_at" timestamp with time zone;

alter table "public"."buddy_bookings" add column "dispute_status" text not null default 'none'::text;

alter table "public"."buddy_bookings" add column "provider_completed_at" timestamp with time zone;

CREATE UNIQUE INDEX admin_permission_presets_pkey ON public.admin_permission_presets USING btree (role_key);

CREATE UNIQUE INDEX admin_role_assignments_one_active_per_user ON public.admin_role_assignments USING btree (user_id) WHERE (status = 'active'::text);

CREATE UNIQUE INDEX admin_role_assignments_pkey ON public.admin_role_assignments USING btree (id);

CREATE UNIQUE INDEX buddy_booking_events_pkey ON public.buddy_booking_events USING btree (id);

CREATE UNIQUE INDEX buddy_disputes_pkey ON public.buddy_disputes USING btree (id);

CREATE UNIQUE INDEX buddy_provider_applications_pkey ON public.buddy_provider_applications USING btree (id);

CREATE UNIQUE INDEX buddy_reviews_booking_reviewer_unique ON public.buddy_reviews USING btree (booking_id, reviewer_user_id);

CREATE UNIQUE INDEX identity_verification_requests_pkey ON public.identity_verification_requests USING btree (id);

CREATE INDEX idx_admin_role_assignments_status_role ON public.admin_role_assignments USING btree (status, role_key, updated_at DESC);

CREATE INDEX idx_admin_role_assignments_user ON public.admin_role_assignments USING btree (user_id, updated_at DESC);

CREATE INDEX idx_buddy_service_slots_provider_start ON public.buddy_service_slots USING btree (provider_user_id, starts_at DESC);

CREATE INDEX idx_buddy_service_slots_service_status_start ON public.buddy_service_slots USING btree (service_id, slot_status, starts_at);

CREATE INDEX idx_identity_verification_requests_user_status ON public.identity_verification_requests USING btree (user_id, review_status, created_at DESC);

CREATE UNIQUE INDEX profiles_handle_unique_lower ON public.profiles USING btree (lower(handle)) WHERE ((handle IS NOT NULL) AND (handle <> ''::text));

CREATE UNIQUE INDEX user_identity_bindings_pkey ON public.user_identity_bindings USING btree (id);

CREATE UNIQUE INDEX user_identity_bindings_user_type_value_unique ON public.user_identity_bindings USING btree (user_id, binding_type, COALESCE(binding_value_masked, ''::text));

alter table "public"."admin_permission_presets" add constraint "admin_permission_presets_pkey" PRIMARY KEY using index "admin_permission_presets_pkey";

alter table "public"."admin_role_assignments" add constraint "admin_role_assignments_pkey" PRIMARY KEY using index "admin_role_assignments_pkey";

alter table "public"."buddy_booking_events" add constraint "buddy_booking_events_pkey" PRIMARY KEY using index "buddy_booking_events_pkey";

alter table "public"."buddy_disputes" add constraint "buddy_disputes_pkey" PRIMARY KEY using index "buddy_disputes_pkey";

alter table "public"."buddy_provider_applications" add constraint "buddy_provider_applications_pkey" PRIMARY KEY using index "buddy_provider_applications_pkey";

alter table "public"."identity_verification_requests" add constraint "identity_verification_requests_pkey" PRIMARY KEY using index "identity_verification_requests_pkey";

alter table "public"."user_identity_bindings" add constraint "user_identity_bindings_pkey" PRIMARY KEY using index "user_identity_bindings_pkey";

alter table "public"."admin_permission_presets" add constraint "admin_permission_presets_role_check" CHECK ((role_key = ANY (ARRAY['owner'::text, 'ops'::text, 'support'::text, 'safety'::text, 'finance'::text, 'viewer'::text, 'custom'::text]))) not valid;

alter table "public"."admin_permission_presets" validate constraint "admin_permission_presets_role_check";

alter table "public"."admin_role_assignments" add constraint "admin_role_assignments_granted_by_admin_user_id_fkey" FOREIGN KEY (granted_by_admin_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."admin_role_assignments" validate constraint "admin_role_assignments_granted_by_admin_user_id_fkey";

alter table "public"."admin_role_assignments" add constraint "admin_role_assignments_revoked_by_admin_user_id_fkey" FOREIGN KEY (revoked_by_admin_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."admin_role_assignments" validate constraint "admin_role_assignments_revoked_by_admin_user_id_fkey";

alter table "public"."admin_role_assignments" add constraint "admin_role_assignments_role_check" CHECK ((role_key = ANY (ARRAY['owner'::text, 'ops'::text, 'support'::text, 'safety'::text, 'finance'::text, 'viewer'::text, 'custom'::text]))) not valid;

alter table "public"."admin_role_assignments" validate constraint "admin_role_assignments_role_check";

alter table "public"."admin_role_assignments" add constraint "admin_role_assignments_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'revoked'::text]))) not valid;

alter table "public"."admin_role_assignments" validate constraint "admin_role_assignments_status_check";

alter table "public"."admin_role_assignments" add constraint "admin_role_assignments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."admin_role_assignments" validate constraint "admin_role_assignments_user_id_fkey";

alter table "public"."buddy_booking_events" add constraint "buddy_booking_events_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."buddy_booking_events" validate constraint "buddy_booking_events_actor_user_id_fkey";

alter table "public"."buddy_booking_events" add constraint "buddy_booking_events_booking_id_fkey" FOREIGN KEY (booking_id) REFERENCES public.buddy_bookings(id) ON DELETE CASCADE not valid;

alter table "public"."buddy_booking_events" validate constraint "buddy_booking_events_booking_id_fkey";

alter table "public"."buddy_disputes" add constraint "buddy_disputes_admin_user_id_fkey" FOREIGN KEY (admin_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."buddy_disputes" validate constraint "buddy_disputes_admin_user_id_fkey";

alter table "public"."buddy_disputes" add constraint "buddy_disputes_booking_id_fkey" FOREIGN KEY (booking_id) REFERENCES public.buddy_bookings(id) ON DELETE CASCADE not valid;

alter table "public"."buddy_disputes" validate constraint "buddy_disputes_booking_id_fkey";

alter table "public"."buddy_disputes" add constraint "buddy_disputes_counterparty_user_id_fkey" FOREIGN KEY (counterparty_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."buddy_disputes" validate constraint "buddy_disputes_counterparty_user_id_fkey";

alter table "public"."buddy_disputes" add constraint "buddy_disputes_opened_by_user_id_fkey" FOREIGN KEY (opened_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."buddy_disputes" validate constraint "buddy_disputes_opened_by_user_id_fkey";

alter table "public"."buddy_disputes" add constraint "buddy_disputes_service_id_fkey" FOREIGN KEY (service_id) REFERENCES public.buddy_services(id) ON DELETE SET NULL not valid;

alter table "public"."buddy_disputes" validate constraint "buddy_disputes_service_id_fkey";

alter table "public"."buddy_disputes" add constraint "buddy_disputes_status_check" CHECK ((dispute_status = ANY (ARRAY['open'::text, 'reviewing'::text, 'resolved'::text, 'rejected'::text, 'cancelled'::text]))) not valid;

alter table "public"."buddy_disputes" validate constraint "buddy_disputes_status_check";

alter table "public"."buddy_provider_applications" add constraint "buddy_provider_applications_identity_request_id_fkey" FOREIGN KEY (identity_request_id) REFERENCES public.identity_verification_requests(id) ON DELETE SET NULL not valid;

alter table "public"."buddy_provider_applications" validate constraint "buddy_provider_applications_identity_request_id_fkey";

alter table "public"."buddy_provider_applications" add constraint "buddy_provider_applications_reviewer_user_id_fkey" FOREIGN KEY (reviewer_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."buddy_provider_applications" validate constraint "buddy_provider_applications_reviewer_user_id_fkey";

alter table "public"."buddy_provider_applications" add constraint "buddy_provider_applications_status_check" CHECK ((application_status = ANY (ARRAY['draft'::text, 'submitted'::text, 'needs_more_info'::text, 'approved'::text, 'rejected'::text, 'suspended'::text]))) not valid;

alter table "public"."buddy_provider_applications" validate constraint "buddy_provider_applications_status_check";

alter table "public"."buddy_provider_applications" add constraint "buddy_provider_applications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."buddy_provider_applications" validate constraint "buddy_provider_applications_user_id_fkey";

alter table "public"."identity_verification_requests" add constraint "identity_verification_requests_reviewer_user_id_fkey" FOREIGN KEY (reviewer_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."identity_verification_requests" validate constraint "identity_verification_requests_reviewer_user_id_fkey";

alter table "public"."identity_verification_requests" add constraint "identity_verification_requests_status_check" CHECK ((review_status = ANY (ARRAY['pending'::text, 'needs_more_info'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text]))) not valid;

alter table "public"."identity_verification_requests" validate constraint "identity_verification_requests_status_check";

alter table "public"."identity_verification_requests" add constraint "identity_verification_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."identity_verification_requests" validate constraint "identity_verification_requests_user_id_fkey";

alter table "public"."user_identity_bindings" add constraint "user_identity_bindings_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text, 'revoked'::text]))) not valid;

alter table "public"."user_identity_bindings" validate constraint "user_identity_bindings_status_check";

alter table "public"."user_identity_bindings" add constraint "user_identity_bindings_type_check" CHECK ((binding_type = ANY (ARRAY['email'::text, 'phone'::text, 'google'::text, 'line'::text, 'telegram'::text, 'manual_review'::text, 'government_id'::text, 'other'::text]))) not valid;

alter table "public"."user_identity_bindings" validate constraint "user_identity_bindings_type_check";

alter table "public"."user_identity_bindings" add constraint "user_identity_bindings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_identity_bindings" validate constraint "user_identity_bindings_user_id_fkey";

grant delete on table "public"."admin_permission_presets" to "anon";

grant insert on table "public"."admin_permission_presets" to "anon";

grant references on table "public"."admin_permission_presets" to "anon";

grant select on table "public"."admin_permission_presets" to "anon";

grant trigger on table "public"."admin_permission_presets" to "anon";

grant truncate on table "public"."admin_permission_presets" to "anon";

grant update on table "public"."admin_permission_presets" to "anon";

grant delete on table "public"."admin_permission_presets" to "authenticated";

grant insert on table "public"."admin_permission_presets" to "authenticated";

grant references on table "public"."admin_permission_presets" to "authenticated";

grant select on table "public"."admin_permission_presets" to "authenticated";

grant trigger on table "public"."admin_permission_presets" to "authenticated";

grant truncate on table "public"."admin_permission_presets" to "authenticated";

grant update on table "public"."admin_permission_presets" to "authenticated";

grant delete on table "public"."admin_permission_presets" to "service_role";

grant insert on table "public"."admin_permission_presets" to "service_role";

grant references on table "public"."admin_permission_presets" to "service_role";

grant select on table "public"."admin_permission_presets" to "service_role";

grant trigger on table "public"."admin_permission_presets" to "service_role";

grant truncate on table "public"."admin_permission_presets" to "service_role";

grant update on table "public"."admin_permission_presets" to "service_role";

grant delete on table "public"."admin_role_assignments" to "anon";

grant insert on table "public"."admin_role_assignments" to "anon";

grant references on table "public"."admin_role_assignments" to "anon";

grant select on table "public"."admin_role_assignments" to "anon";

grant trigger on table "public"."admin_role_assignments" to "anon";

grant truncate on table "public"."admin_role_assignments" to "anon";

grant update on table "public"."admin_role_assignments" to "anon";

grant delete on table "public"."admin_role_assignments" to "authenticated";

grant insert on table "public"."admin_role_assignments" to "authenticated";

grant references on table "public"."admin_role_assignments" to "authenticated";

grant select on table "public"."admin_role_assignments" to "authenticated";

grant trigger on table "public"."admin_role_assignments" to "authenticated";

grant truncate on table "public"."admin_role_assignments" to "authenticated";

grant update on table "public"."admin_role_assignments" to "authenticated";

grant delete on table "public"."admin_role_assignments" to "service_role";

grant insert on table "public"."admin_role_assignments" to "service_role";

grant references on table "public"."admin_role_assignments" to "service_role";

grant select on table "public"."admin_role_assignments" to "service_role";

grant trigger on table "public"."admin_role_assignments" to "service_role";

grant truncate on table "public"."admin_role_assignments" to "service_role";

grant update on table "public"."admin_role_assignments" to "service_role";

grant delete on table "public"."buddy_booking_events" to "anon";

grant insert on table "public"."buddy_booking_events" to "anon";

grant references on table "public"."buddy_booking_events" to "anon";

grant select on table "public"."buddy_booking_events" to "anon";

grant trigger on table "public"."buddy_booking_events" to "anon";

grant truncate on table "public"."buddy_booking_events" to "anon";

grant update on table "public"."buddy_booking_events" to "anon";

grant delete on table "public"."buddy_booking_events" to "authenticated";

grant insert on table "public"."buddy_booking_events" to "authenticated";

grant references on table "public"."buddy_booking_events" to "authenticated";

grant select on table "public"."buddy_booking_events" to "authenticated";

grant trigger on table "public"."buddy_booking_events" to "authenticated";

grant truncate on table "public"."buddy_booking_events" to "authenticated";

grant update on table "public"."buddy_booking_events" to "authenticated";

grant delete on table "public"."buddy_booking_events" to "service_role";

grant insert on table "public"."buddy_booking_events" to "service_role";

grant references on table "public"."buddy_booking_events" to "service_role";

grant select on table "public"."buddy_booking_events" to "service_role";

grant trigger on table "public"."buddy_booking_events" to "service_role";

grant truncate on table "public"."buddy_booking_events" to "service_role";

grant update on table "public"."buddy_booking_events" to "service_role";

grant delete on table "public"."buddy_disputes" to "anon";

grant insert on table "public"."buddy_disputes" to "anon";

grant references on table "public"."buddy_disputes" to "anon";

grant select on table "public"."buddy_disputes" to "anon";

grant trigger on table "public"."buddy_disputes" to "anon";

grant truncate on table "public"."buddy_disputes" to "anon";

grant update on table "public"."buddy_disputes" to "anon";

grant delete on table "public"."buddy_disputes" to "authenticated";

grant insert on table "public"."buddy_disputes" to "authenticated";

grant references on table "public"."buddy_disputes" to "authenticated";

grant select on table "public"."buddy_disputes" to "authenticated";

grant trigger on table "public"."buddy_disputes" to "authenticated";

grant truncate on table "public"."buddy_disputes" to "authenticated";

grant update on table "public"."buddy_disputes" to "authenticated";

grant delete on table "public"."buddy_disputes" to "service_role";

grant insert on table "public"."buddy_disputes" to "service_role";

grant references on table "public"."buddy_disputes" to "service_role";

grant select on table "public"."buddy_disputes" to "service_role";

grant trigger on table "public"."buddy_disputes" to "service_role";

grant truncate on table "public"."buddy_disputes" to "service_role";

grant update on table "public"."buddy_disputes" to "service_role";

grant delete on table "public"."buddy_provider_applications" to "anon";

grant insert on table "public"."buddy_provider_applications" to "anon";

grant references on table "public"."buddy_provider_applications" to "anon";

grant select on table "public"."buddy_provider_applications" to "anon";

grant trigger on table "public"."buddy_provider_applications" to "anon";

grant truncate on table "public"."buddy_provider_applications" to "anon";

grant update on table "public"."buddy_provider_applications" to "anon";

grant delete on table "public"."buddy_provider_applications" to "authenticated";

grant insert on table "public"."buddy_provider_applications" to "authenticated";

grant references on table "public"."buddy_provider_applications" to "authenticated";

grant select on table "public"."buddy_provider_applications" to "authenticated";

grant trigger on table "public"."buddy_provider_applications" to "authenticated";

grant truncate on table "public"."buddy_provider_applications" to "authenticated";

grant update on table "public"."buddy_provider_applications" to "authenticated";

grant delete on table "public"."buddy_provider_applications" to "service_role";

grant insert on table "public"."buddy_provider_applications" to "service_role";

grant references on table "public"."buddy_provider_applications" to "service_role";

grant select on table "public"."buddy_provider_applications" to "service_role";

grant trigger on table "public"."buddy_provider_applications" to "service_role";

grant truncate on table "public"."buddy_provider_applications" to "service_role";

grant update on table "public"."buddy_provider_applications" to "service_role";

grant delete on table "public"."identity_verification_requests" to "anon";

grant insert on table "public"."identity_verification_requests" to "anon";

grant references on table "public"."identity_verification_requests" to "anon";

grant select on table "public"."identity_verification_requests" to "anon";

grant trigger on table "public"."identity_verification_requests" to "anon";

grant truncate on table "public"."identity_verification_requests" to "anon";

grant update on table "public"."identity_verification_requests" to "anon";

grant delete on table "public"."identity_verification_requests" to "authenticated";

grant insert on table "public"."identity_verification_requests" to "authenticated";

grant references on table "public"."identity_verification_requests" to "authenticated";

grant select on table "public"."identity_verification_requests" to "authenticated";

grant trigger on table "public"."identity_verification_requests" to "authenticated";

grant truncate on table "public"."identity_verification_requests" to "authenticated";

grant update on table "public"."identity_verification_requests" to "authenticated";

grant delete on table "public"."identity_verification_requests" to "service_role";

grant insert on table "public"."identity_verification_requests" to "service_role";

grant references on table "public"."identity_verification_requests" to "service_role";

grant select on table "public"."identity_verification_requests" to "service_role";

grant trigger on table "public"."identity_verification_requests" to "service_role";

grant truncate on table "public"."identity_verification_requests" to "service_role";

grant update on table "public"."identity_verification_requests" to "service_role";

grant delete on table "public"."user_identity_bindings" to "anon";

grant insert on table "public"."user_identity_bindings" to "anon";

grant references on table "public"."user_identity_bindings" to "anon";

grant select on table "public"."user_identity_bindings" to "anon";

grant trigger on table "public"."user_identity_bindings" to "anon";

grant truncate on table "public"."user_identity_bindings" to "anon";

grant update on table "public"."user_identity_bindings" to "anon";

grant delete on table "public"."user_identity_bindings" to "authenticated";

grant insert on table "public"."user_identity_bindings" to "authenticated";

grant references on table "public"."user_identity_bindings" to "authenticated";

grant select on table "public"."user_identity_bindings" to "authenticated";

grant trigger on table "public"."user_identity_bindings" to "authenticated";

grant truncate on table "public"."user_identity_bindings" to "authenticated";

grant update on table "public"."user_identity_bindings" to "authenticated";

grant delete on table "public"."user_identity_bindings" to "service_role";

grant insert on table "public"."user_identity_bindings" to "service_role";

grant references on table "public"."user_identity_bindings" to "service_role";

grant select on table "public"."user_identity_bindings" to "service_role";

grant trigger on table "public"."user_identity_bindings" to "service_role";

grant truncate on table "public"."user_identity_bindings" to "service_role";

grant update on table "public"."user_identity_bindings" to "service_role";


  create policy "provider_applications_select_own"
  on "public"."buddy_provider_applications"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "identity_requests_select_own"
  on "public"."identity_verification_requests"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "profiles_select_public_or_own"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using (((visibility = 'public'::text) OR (user_id = auth.uid())));



  create policy "identity_bindings_select_own"
  on "public"."user_identity_bindings"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



