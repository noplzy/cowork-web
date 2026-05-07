
  create table "public"."ai_room_host_sessions" (
    "id" uuid not null default gen_random_uuid(),
    "room_id" uuid not null,
    "payer_user_id" uuid,
    "ai_mode" text not null,
    "host_credit_budget" integer not null default 0,
    "host_credit_used" integer not null default 0,
    "active_seconds" integer not null default 0,
    "provider" text,
    "provider_session_id" text,
    "summary_json" jsonb not null default '{}'::jsonb,
    "stop_reason" text,
    "started_at" timestamp with time zone not null default now(),
    "ended_at" timestamp with time zone,
    "sponsor_user_id" uuid not null,
    "host_credit_spent" integer not null default 0,
    "mode" text not null,
    "status" text not null default 'reserved'::text,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."ai_room_host_sessions" enable row level security;


  create table "public"."ai_usage_events" (
    "id" uuid not null default gen_random_uuid(),
    "room_id" uuid,
    "session_id" uuid,
    "ai_mode" text not null,
    "payer_user_id" uuid,
    "benefited_user_ids" uuid[] not null default ARRAY[]::uuid[],
    "host_credit_used" integer not null default 0,
    "shared_host_active_seconds" integer not null default 0,
    "personal_ai_active_seconds" integer not null default 0,
    "provider_cost_estimate_twd" numeric(10,4),
    "provider_error_code" text,
    "stop_reason" text,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "user_id" uuid not null,
    "ai_session_id" uuid,
    "mode" text not null,
    "provider" text,
    "model" text,
    "input_tokens" integer,
    "output_tokens" integer,
    "estimated_cost_usd" numeric(12,6)
      );


alter table "public"."ai_usage_events" enable row level security;


  create table "public"."room_presence_events" (
    "id" uuid not null default gen_random_uuid(),
    "room_id" uuid not null,
    "user_id" uuid not null,
    "presence_mode" text not null,
    "event_type" text not null,
    "visible_state" text,
    "audio_track_state" text,
    "video_track_state" text,
    "brb_until" timestamp with time zone,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."room_presence_events" enable row level security;

CREATE UNIQUE INDEX ai_room_host_sessions_pkey ON public.ai_room_host_sessions USING btree (id);

CREATE INDEX ai_room_host_sessions_room_created_idx ON public.ai_room_host_sessions USING btree (room_id, created_at DESC);

CREATE INDEX ai_room_host_sessions_room_started_idx ON public.ai_room_host_sessions USING btree (room_id, started_at DESC);

CREATE INDEX ai_room_host_sessions_sponsor_created_idx ON public.ai_room_host_sessions USING btree (sponsor_user_id, created_at DESC);

CREATE INDEX ai_usage_events_payer_created_idx ON public.ai_usage_events USING btree (payer_user_id, created_at DESC);

CREATE UNIQUE INDEX ai_usage_events_pkey ON public.ai_usage_events USING btree (id);

CREATE INDEX ai_usage_events_room_created_idx ON public.ai_usage_events USING btree (room_id, created_at DESC);

CREATE INDEX ai_usage_events_user_created_idx ON public.ai_usage_events USING btree (user_id, created_at DESC);

CREATE UNIQUE INDEX room_presence_events_pkey ON public.room_presence_events USING btree (id);

CREATE INDEX room_presence_events_room_created_idx ON public.room_presence_events USING btree (room_id, created_at DESC);

CREATE INDEX room_presence_events_user_created_idx ON public.room_presence_events USING btree (user_id, created_at DESC);

alter table "public"."ai_room_host_sessions" add constraint "ai_room_host_sessions_pkey" PRIMARY KEY using index "ai_room_host_sessions_pkey";

alter table "public"."ai_usage_events" add constraint "ai_usage_events_pkey" PRIMARY KEY using index "ai_usage_events_pkey";

alter table "public"."room_presence_events" add constraint "room_presence_events_pkey" PRIMARY KEY using index "room_presence_events_pkey";

alter table "public"."ai_room_host_sessions" add constraint "ai_room_host_sessions_ai_mode_check" CHECK ((ai_mode = ANY (ARRAY['global'::text, 'room-personal'::text, 'room-host'::text]))) not valid;

alter table "public"."ai_room_host_sessions" validate constraint "ai_room_host_sessions_ai_mode_check";

alter table "public"."ai_room_host_sessions" add constraint "ai_room_host_sessions_credit_check" CHECK ((host_credit_spent >= 0)) not valid;

alter table "public"."ai_room_host_sessions" validate constraint "ai_room_host_sessions_credit_check";

alter table "public"."ai_room_host_sessions" add constraint "ai_room_host_sessions_mode_check" CHECK ((mode = ANY (ARRAY['global'::text, 'personal'::text, 'shared_host'::text]))) not valid;

alter table "public"."ai_room_host_sessions" validate constraint "ai_room_host_sessions_mode_check";

alter table "public"."ai_room_host_sessions" add constraint "ai_room_host_sessions_payer_user_id_fkey" FOREIGN KEY (payer_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."ai_room_host_sessions" validate constraint "ai_room_host_sessions_payer_user_id_fkey";

alter table "public"."ai_room_host_sessions" add constraint "ai_room_host_sessions_room_fk" FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE not valid;

alter table "public"."ai_room_host_sessions" validate constraint "ai_room_host_sessions_room_fk";

alter table "public"."ai_room_host_sessions" add constraint "ai_room_host_sessions_room_id_fkey" FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE not valid;

alter table "public"."ai_room_host_sessions" validate constraint "ai_room_host_sessions_room_id_fkey";

alter table "public"."ai_room_host_sessions" add constraint "ai_room_host_sessions_sponsor_fk" FOREIGN KEY (sponsor_user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."ai_room_host_sessions" validate constraint "ai_room_host_sessions_sponsor_fk";

alter table "public"."ai_room_host_sessions" add constraint "ai_room_host_sessions_status_check" CHECK ((status = ANY (ARRAY['reserved'::text, 'active'::text, 'ended'::text, 'cancelled'::text, 'failed'::text]))) not valid;

alter table "public"."ai_room_host_sessions" validate constraint "ai_room_host_sessions_status_check";

alter table "public"."ai_usage_events" add constraint "ai_usage_events_ai_mode_check" CHECK ((ai_mode = ANY (ARRAY['global'::text, 'room-personal'::text, 'room-host'::text]))) not valid;

alter table "public"."ai_usage_events" validate constraint "ai_usage_events_ai_mode_check";

alter table "public"."ai_usage_events" add constraint "ai_usage_events_input_tokens_check" CHECK (((input_tokens IS NULL) OR (input_tokens >= 0))) not valid;

alter table "public"."ai_usage_events" validate constraint "ai_usage_events_input_tokens_check";

alter table "public"."ai_usage_events" add constraint "ai_usage_events_mode_check" CHECK ((mode = ANY (ARRAY['global'::text, 'personal'::text, 'shared_host'::text]))) not valid;

alter table "public"."ai_usage_events" validate constraint "ai_usage_events_mode_check";

alter table "public"."ai_usage_events" add constraint "ai_usage_events_output_tokens_check" CHECK (((output_tokens IS NULL) OR (output_tokens >= 0))) not valid;

alter table "public"."ai_usage_events" validate constraint "ai_usage_events_output_tokens_check";

alter table "public"."ai_usage_events" add constraint "ai_usage_events_payer_user_id_fkey" FOREIGN KEY (payer_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."ai_usage_events" validate constraint "ai_usage_events_payer_user_id_fkey";

alter table "public"."ai_usage_events" add constraint "ai_usage_events_room_fk" FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE SET NULL not valid;

alter table "public"."ai_usage_events" validate constraint "ai_usage_events_room_fk";

alter table "public"."ai_usage_events" add constraint "ai_usage_events_room_id_fkey" FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE SET NULL not valid;

alter table "public"."ai_usage_events" validate constraint "ai_usage_events_room_id_fkey";

alter table "public"."ai_usage_events" add constraint "ai_usage_events_session_fk" FOREIGN KEY (ai_session_id) REFERENCES public.ai_room_host_sessions(id) ON DELETE SET NULL not valid;

alter table "public"."ai_usage_events" validate constraint "ai_usage_events_session_fk";

alter table "public"."ai_usage_events" add constraint "ai_usage_events_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.ai_room_host_sessions(id) ON DELETE SET NULL not valid;

alter table "public"."ai_usage_events" validate constraint "ai_usage_events_session_id_fkey";

alter table "public"."ai_usage_events" add constraint "ai_usage_events_user_fk" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."ai_usage_events" validate constraint "ai_usage_events_user_fk";

alter table "public"."room_presence_events" add constraint "room_presence_events_event_type_check" CHECK ((event_type = ANY (ARRAY['join'::text, 'heartbeat'::text, 'visibility'::text, 'media_state'::text, 'brb_start'::text, 'brb_end'::text, 'extension_confirm'::text, 'leave'::text]))) not valid;

alter table "public"."room_presence_events" validate constraint "room_presence_events_event_type_check";

alter table "public"."room_presence_events" add constraint "room_presence_events_presence_mode_check" CHECK ((presence_mode = ANY (ARRAY['quiet'::text, 'audio'::text, 'mosaic'::text, 'camera'::text]))) not valid;

alter table "public"."room_presence_events" validate constraint "room_presence_events_presence_mode_check";

alter table "public"."room_presence_events" add constraint "room_presence_events_room_fk" FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE not valid;

alter table "public"."room_presence_events" validate constraint "room_presence_events_room_fk";

alter table "public"."room_presence_events" add constraint "room_presence_events_room_id_fkey" FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE not valid;

alter table "public"."room_presence_events" validate constraint "room_presence_events_room_id_fkey";

alter table "public"."room_presence_events" add constraint "room_presence_events_user_fk" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."room_presence_events" validate constraint "room_presence_events_user_fk";

alter table "public"."room_presence_events" add constraint "room_presence_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."room_presence_events" validate constraint "room_presence_events_user_id_fkey";

alter table "public"."room_presence_events" add constraint "room_presence_events_visible_state_check" CHECK ((visible_state = ANY (ARRAY['visible'::text, 'hidden'::text]))) not valid;

alter table "public"."room_presence_events" validate constraint "room_presence_events_visible_state_check";

grant delete on table "public"."ai_room_host_sessions" to "anon";

grant insert on table "public"."ai_room_host_sessions" to "anon";

grant references on table "public"."ai_room_host_sessions" to "anon";

grant select on table "public"."ai_room_host_sessions" to "anon";

grant trigger on table "public"."ai_room_host_sessions" to "anon";

grant truncate on table "public"."ai_room_host_sessions" to "anon";

grant update on table "public"."ai_room_host_sessions" to "anon";

grant delete on table "public"."ai_room_host_sessions" to "authenticated";

grant insert on table "public"."ai_room_host_sessions" to "authenticated";

grant references on table "public"."ai_room_host_sessions" to "authenticated";

grant select on table "public"."ai_room_host_sessions" to "authenticated";

grant trigger on table "public"."ai_room_host_sessions" to "authenticated";

grant truncate on table "public"."ai_room_host_sessions" to "authenticated";

grant update on table "public"."ai_room_host_sessions" to "authenticated";

grant delete on table "public"."ai_room_host_sessions" to "service_role";

grant insert on table "public"."ai_room_host_sessions" to "service_role";

grant references on table "public"."ai_room_host_sessions" to "service_role";

grant select on table "public"."ai_room_host_sessions" to "service_role";

grant trigger on table "public"."ai_room_host_sessions" to "service_role";

grant truncate on table "public"."ai_room_host_sessions" to "service_role";

grant update on table "public"."ai_room_host_sessions" to "service_role";

grant delete on table "public"."ai_usage_events" to "anon";

grant insert on table "public"."ai_usage_events" to "anon";

grant references on table "public"."ai_usage_events" to "anon";

grant select on table "public"."ai_usage_events" to "anon";

grant trigger on table "public"."ai_usage_events" to "anon";

grant truncate on table "public"."ai_usage_events" to "anon";

grant update on table "public"."ai_usage_events" to "anon";

grant delete on table "public"."ai_usage_events" to "authenticated";

grant insert on table "public"."ai_usage_events" to "authenticated";

grant references on table "public"."ai_usage_events" to "authenticated";

grant select on table "public"."ai_usage_events" to "authenticated";

grant trigger on table "public"."ai_usage_events" to "authenticated";

grant truncate on table "public"."ai_usage_events" to "authenticated";

grant update on table "public"."ai_usage_events" to "authenticated";

grant delete on table "public"."ai_usage_events" to "service_role";

grant insert on table "public"."ai_usage_events" to "service_role";

grant references on table "public"."ai_usage_events" to "service_role";

grant select on table "public"."ai_usage_events" to "service_role";

grant trigger on table "public"."ai_usage_events" to "service_role";

grant truncate on table "public"."ai_usage_events" to "service_role";

grant update on table "public"."ai_usage_events" to "service_role";

grant delete on table "public"."room_presence_events" to "anon";

grant insert on table "public"."room_presence_events" to "anon";

grant references on table "public"."room_presence_events" to "anon";

grant select on table "public"."room_presence_events" to "anon";

grant trigger on table "public"."room_presence_events" to "anon";

grant truncate on table "public"."room_presence_events" to "anon";

grant update on table "public"."room_presence_events" to "anon";

grant delete on table "public"."room_presence_events" to "authenticated";

grant insert on table "public"."room_presence_events" to "authenticated";

grant references on table "public"."room_presence_events" to "authenticated";

grant select on table "public"."room_presence_events" to "authenticated";

grant trigger on table "public"."room_presence_events" to "authenticated";

grant truncate on table "public"."room_presence_events" to "authenticated";

grant update on table "public"."room_presence_events" to "authenticated";

grant delete on table "public"."room_presence_events" to "service_role";

grant insert on table "public"."room_presence_events" to "service_role";

grant references on table "public"."room_presence_events" to "service_role";

grant select on table "public"."room_presence_events" to "service_role";

grant trigger on table "public"."room_presence_events" to "service_role";

grant truncate on table "public"."room_presence_events" to "service_role";

grant update on table "public"."room_presence_events" to "service_role";


  create policy "ai host sessions payer read"
  on "public"."ai_room_host_sessions"
  as permissive
  for select
  to authenticated
using ((auth.uid() = payer_user_id));



  create policy "ai host sessions readable by room members"
  on "public"."ai_room_host_sessions"
  as permissive
  for select
  to authenticated
using (((sponsor_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.room_members rm
  WHERE ((rm.room_id = ai_room_host_sessions.room_id) AND (rm.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.rooms r
  WHERE ((r.id = ai_room_host_sessions.room_id) AND (r.created_by = auth.uid()))))));



  create policy "ai usage payer read"
  on "public"."ai_usage_events"
  as permissive
  for select
  to authenticated
using (((auth.uid() = payer_user_id) OR (auth.uid() = ANY (benefited_user_ids))));



  create policy "users can read own ai usage"
  on "public"."ai_usage_events"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "room presence own insert"
  on "public"."room_presence_events"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "room presence own read"
  on "public"."room_presence_events"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "room presence readable by room members"
  on "public"."room_presence_events"
  as permissive
  for select
  to authenticated
using (((EXISTS ( SELECT 1
   FROM public.room_members rm
  WHERE ((rm.room_id = room_presence_events.room_id) AND (rm.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.rooms r
  WHERE ((r.id = room_presence_events.room_id) AND (r.created_by = auth.uid()))))));



  create policy "users can insert own room presence"
  on "public"."room_presence_events"
  as permissive
  for insert
  to authenticated
with check (((user_id = auth.uid()) AND ((EXISTS ( SELECT 1
   FROM public.room_members rm
  WHERE ((rm.room_id = room_presence_events.room_id) AND (rm.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.rooms r
  WHERE ((r.id = room_presence_events.room_id) AND (r.created_by = auth.uid())))))));



