create type "public"."ai_mode" as enum ('global-guide', 'room-personal', 'room-host');

create type "public"."ai_session_status" as enum ('pending', 'active', 'ended', 'error');

create type "public"."ai_usage_event_type" as enum ('session_start', 'session_end', 'message', 'host_intervention', 'tts_start', 'tts_end', 'error');

create type "public"."presence_mode" as enum ('quiet', 'audio', 'mosaic', 'camera');

create type "public"."room_presence_event_type" as enum ('selected', 'heartbeat', 'visible', 'hidden', 'audio_on', 'audio_off', 'video_on', 'video_off', 'brb_start', 'brb_end', 'extension_confirmed', 'left');


  create table "public"."ai_user_mode_preferences" (
    "user_id" uuid not null,
    "default_global_persona" text not null default 'calm-guide'::text,
    "default_room_persona" text not null default 'calm-companion'::text,
    "prefers_shared_host_first" boolean not null default true,
    "default_presence_mode" public.presence_mode not null default 'quiet'::public.presence_mode,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."ai_user_mode_preferences" enable row level security;

CREATE UNIQUE INDEX ai_user_mode_preferences_pkey ON public.ai_user_mode_preferences USING btree (user_id);

CREATE INDEX idx_ai_room_host_sessions_payer_user_id ON public.ai_room_host_sessions USING btree (payer_user_id);

CREATE INDEX idx_ai_room_host_sessions_room_id ON public.ai_room_host_sessions USING btree (room_id);

CREATE INDEX idx_ai_room_host_sessions_status ON public.ai_room_host_sessions USING btree (status);

CREATE INDEX idx_ai_usage_events_mode_created ON public.ai_usage_events USING btree (ai_mode, created_at DESC);

CREATE INDEX idx_ai_usage_events_room_id_created ON public.ai_usage_events USING btree (room_id, created_at DESC);

CREATE INDEX idx_ai_usage_events_user_id_created ON public.ai_usage_events USING btree (user_id, created_at DESC);

CREATE INDEX idx_room_presence_events_room_created ON public.room_presence_events USING btree (room_id, created_at DESC);

CREATE INDEX idx_room_presence_events_user_created ON public.room_presence_events USING btree (user_id, created_at DESC);

alter table "public"."ai_user_mode_preferences" add constraint "ai_user_mode_preferences_pkey" PRIMARY KEY using index "ai_user_mode_preferences_pkey";

alter table "public"."ai_user_mode_preferences" add constraint "ai_user_mode_preferences_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."ai_user_mode_preferences" validate constraint "ai_user_mode_preferences_user_id_fkey";

grant delete on table "public"."ai_user_mode_preferences" to "anon";

grant insert on table "public"."ai_user_mode_preferences" to "anon";

grant references on table "public"."ai_user_mode_preferences" to "anon";

grant select on table "public"."ai_user_mode_preferences" to "anon";

grant trigger on table "public"."ai_user_mode_preferences" to "anon";

grant truncate on table "public"."ai_user_mode_preferences" to "anon";

grant update on table "public"."ai_user_mode_preferences" to "anon";

grant delete on table "public"."ai_user_mode_preferences" to "authenticated";

grant insert on table "public"."ai_user_mode_preferences" to "authenticated";

grant references on table "public"."ai_user_mode_preferences" to "authenticated";

grant select on table "public"."ai_user_mode_preferences" to "authenticated";

grant trigger on table "public"."ai_user_mode_preferences" to "authenticated";

grant truncate on table "public"."ai_user_mode_preferences" to "authenticated";

grant update on table "public"."ai_user_mode_preferences" to "authenticated";

grant delete on table "public"."ai_user_mode_preferences" to "service_role";

grant insert on table "public"."ai_user_mode_preferences" to "service_role";

grant references on table "public"."ai_user_mode_preferences" to "service_role";

grant select on table "public"."ai_user_mode_preferences" to "service_role";

grant trigger on table "public"."ai_user_mode_preferences" to "service_role";

grant truncate on table "public"."ai_user_mode_preferences" to "service_role";

grant update on table "public"."ai_user_mode_preferences" to "service_role";


  create policy "ai_room_host_sessions_select_room_members"
  on "public"."ai_room_host_sessions"
  as permissive
  for select
  to public
using (((EXISTS ( SELECT 1
   FROM public.room_members rm
  WHERE ((rm.room_id = ai_room_host_sessions.room_id) AND (rm.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.rooms r
  WHERE ((r.id = ai_room_host_sessions.room_id) AND (r.created_by = auth.uid()))))));



  create policy "ai_usage_events_select_own"
  on "public"."ai_usage_events"
  as permissive
  for select
  to public
using (((auth.uid() = user_id) OR (auth.uid() = payer_user_id)));



  create policy "ai_user_mode_preferences_select_own"
  on "public"."ai_user_mode_preferences"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "ai_user_mode_preferences_update_own"
  on "public"."ai_user_mode_preferences"
  as permissive
  for update
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "ai_user_mode_preferences_upsert_own"
  on "public"."ai_user_mode_preferences"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "room_presence_events_select_own"
  on "public"."room_presence_events"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



