drop trigger if exists "trg_room_members_cleanup_empty_room" on "public"."room_members";

alter table "public"."room_presence_events" drop constraint "room_presence_events_event_type_check";

drop function if exists "public"."cleanup_empty_room_after_member_leave"();

drop index if exists "public"."rooms_one_owner_active_idx";


  create table "public"."room_access_sessions" (
    "id" uuid not null default gen_random_uuid(),
    "room_id" uuid not null,
    "user_id" uuid not null,
    "daily_room_name" text not null,
    "billing_session_key" text not null,
    "duration_minutes" integer not null,
    "cost_credits" integer not null default 0,
    "charge_status" text not null default 'pending'::text,
    "charged_at" timestamp with time zone,
    "last_token_issued_at" timestamp with time zone,
    "token_exp" timestamp with time zone,
    "entitlement_source" text not null default 'free_credits'::text,
    "allowed_by_pair_vip_carry" boolean not null default false,
    "join_confirmed_at" timestamp with time zone,
    "last_presence_at" timestamp with time zone,
    "status" text not null default 'active'::text,
    "provider_payload" jsonb not null default '{}'::jsonb,
    "last_error" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."room_access_sessions" enable row level security;


  create table "public"."room_lifecycle_events" (
    "id" uuid not null default gen_random_uuid(),
    "room_id" uuid,
    "actor_user_id" uuid,
    "event_type" text not null,
    "reason" text,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."room_lifecycle_events" enable row level security;

alter table "public"."room_presence_events" add column "access_session_id" uuid;

alter table "public"."room_presence_events" add column "heartbeat_at" timestamp with time zone;

alter table "public"."room_presence_events" add column "media_track_state" jsonb not null default '{}'::jsonb;

alter table "public"."rooms" add column "cleanup_reason" text;

alter table "public"."rooms" add column "daily_room_delete_error" text;

alter table "public"."rooms" add column "daily_room_deleted_at" timestamp with time zone;

alter table "public"."rooms" add column "ended_at" timestamp with time zone;

alter table "public"."rooms" add column "last_presence_at" timestamp with time zone;

alter table "public"."rooms" add column "scheduled_end_at" timestamp with time zone;

alter table "public"."rooms" add column "started_at" timestamp with time zone;

alter table "public"."rooms" add column "status" text not null default 'active'::text;

CREATE INDEX idx_room_access_sessions_room_user ON public.room_access_sessions USING btree (room_id, user_id, created_at DESC);

CREATE INDEX idx_room_access_sessions_status ON public.room_access_sessions USING btree (status, token_exp DESC);

CREATE INDEX idx_room_lifecycle_events_actor_created ON public.room_lifecycle_events USING btree (actor_user_id, created_at DESC);

CREATE INDEX idx_room_lifecycle_events_room_created ON public.room_lifecycle_events USING btree (room_id, created_at DESC);

CREATE INDEX idx_room_presence_events_access_session ON public.room_presence_events USING btree (access_session_id, created_at DESC);

CREATE INDEX idx_rooms_daily_room_deleted_at ON public.rooms USING btree (daily_room_deleted_at);

CREATE INDEX idx_rooms_last_presence_at ON public.rooms USING btree (last_presence_at DESC);

CREATE INDEX idx_rooms_status_scheduled_end ON public.rooms USING btree (status, scheduled_end_at DESC);

CREATE UNIQUE INDEX room_access_sessions_pkey ON public.room_access_sessions USING btree (id);

CREATE UNIQUE INDEX room_access_sessions_unique_billing ON public.room_access_sessions USING btree (room_id, user_id, billing_session_key);

CREATE UNIQUE INDEX room_lifecycle_events_pkey ON public.room_lifecycle_events USING btree (id);

CREATE UNIQUE INDEX rooms_one_owner_active_idx ON public.rooms USING btree (created_by) WHERE ((status = 'active'::text) AND (ended_at IS NULL));

alter table "public"."room_access_sessions" add constraint "room_access_sessions_pkey" PRIMARY KEY using index "room_access_sessions_pkey";

alter table "public"."room_lifecycle_events" add constraint "room_lifecycle_events_pkey" PRIMARY KEY using index "room_lifecycle_events_pkey";

alter table "public"."room_access_sessions" add constraint "room_access_sessions_room_id_fkey" FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE not valid;

alter table "public"."room_access_sessions" validate constraint "room_access_sessions_room_id_fkey";

alter table "public"."room_access_sessions" add constraint "room_access_sessions_unique_billing" UNIQUE using index "room_access_sessions_unique_billing";

alter table "public"."room_access_sessions" add constraint "room_access_sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."room_access_sessions" validate constraint "room_access_sessions_user_id_fkey";

alter table "public"."room_lifecycle_events" add constraint "room_lifecycle_events_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."room_lifecycle_events" validate constraint "room_lifecycle_events_actor_user_id_fkey";

alter table "public"."room_lifecycle_events" add constraint "room_lifecycle_events_room_id_fkey" FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE SET NULL not valid;

alter table "public"."room_lifecycle_events" validate constraint "room_lifecycle_events_room_id_fkey";

alter table "public"."room_presence_events" add constraint "room_presence_events_access_session_id_fkey" FOREIGN KEY (access_session_id) REFERENCES public.room_access_sessions(id) ON DELETE SET NULL not valid;

alter table "public"."room_presence_events" validate constraint "room_presence_events_access_session_id_fkey";

alter table "public"."rooms" add constraint "rooms_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'ended'::text, 'expired'::text, 'error'::text]))) not valid;

alter table "public"."rooms" validate constraint "rooms_status_check";

alter table "public"."room_presence_events" add constraint "room_presence_events_event_type_check" CHECK ((event_type = ANY (ARRAY['join'::text, 'heartbeat'::text, 'visibility'::text, 'media_state'::text, 'brb_start'::text, 'brb_end'::text, 'extension_confirm'::text, 'leave'::text, 'selected'::text, 'visible'::text, 'hidden'::text, 'audio_on'::text, 'audio_off'::text, 'video_on'::text, 'video_off'::text, 'extension_confirmed'::text, 'left'::text]))) not valid;

alter table "public"."room_presence_events" validate constraint "room_presence_events_event_type_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.cowork_cleanup_expired_rooms(p_grace_minutes integer DEFAULT 5, p_presence_grace_minutes integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_room record;
  v_updated integer := 0;
  v_ids uuid[] := array[]::uuid[];
begin
  for v_room in
    select id
    from public.rooms
    where coalesce(status, 'active') = 'active'
      and (
        (scheduled_end_at is not null and scheduled_end_at < now() - make_interval(mins => greatest(coalesce(p_grace_minutes, 5), 1)))
        or (
          scheduled_end_at is null
          and created_at + make_interval(mins => coalesce(duration_minutes, 25) + greatest(coalesce(p_grace_minutes, 5), 1)) < now()
        )
      )
      and (
        last_presence_at is null
        or last_presence_at < now() - make_interval(mins => greatest(coalesce(p_presence_grace_minutes, 10), 1))
      )
    for update
  loop
    update public.rooms
    set status = 'ended',
        ended_at = coalesce(ended_at, now()),
        cleanup_reason = coalesce(cleanup_reason, 'expired_empty_room')
    where id = v_room.id
      and coalesce(status, 'active') = 'active';

    if found then
      v_updated := v_updated + 1;
      v_ids := array_append(v_ids, v_room.id);
    end if;
  end loop;

  if coalesce(array_length(v_ids, 1), 0) > 0 then
    delete from public.room_members
    where room_id = any(v_ids);

    update public.room_access_sessions
    set status = 'ended',
        updated_at = now()
    where room_id = any(v_ids)
      and status = 'active';
  end if;

  return jsonb_build_object('updated', v_updated, 'room_ids', v_ids);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.cowork_end_room_for_user(p_room_id uuid, p_user_id uuid, p_reason text DEFAULT 'user_left'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_room record;
  v_remaining integer := 0;
  v_was_member boolean := false;
begin
  if p_room_id is null or p_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'MISSING_ARGUMENT');
  end if;

  select id, created_by, daily_room_url, status, ended_at
    into v_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'ROOM_NOT_FOUND');
  end if;

  select exists(
    select 1 from public.room_members
    where room_id = p_room_id and user_id = p_user_id
  ) into v_was_member;

  if not v_was_member and v_room.created_by <> p_user_id then
    return jsonb_build_object('ok', false, 'code', 'NOT_A_MEMBER');
  end if;

  delete from public.room_members
  where room_id = p_room_id
    and user_id = p_user_id;

  update public.room_access_sessions
  set status = 'ended',
      last_presence_at = null,
      updated_at = now()
  where room_id = p_room_id
    and user_id = p_user_id
    and status = 'active';

  select count(*) into v_remaining
  from public.room_members
  where room_id = p_room_id;

  if v_remaining <= 0 and coalesce(v_room.status, 'active') = 'active' and v_room.ended_at is null then
    update public.rooms
    set status = 'ended',
        ended_at = now(),
        cleanup_reason = coalesce(nullif(trim(p_reason), ''), 'empty_after_leave')
    where id = p_room_id;

    update public.room_access_sessions
    set status = 'ended',
        updated_at = now()
    where room_id = p_room_id
      and status = 'active';

    return jsonb_build_object(
      'ok', true,
      'left', true,
      'room_ended', true,
      'remaining_members', v_remaining,
      'daily_room_url', v_room.daily_room_url
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'left', true,
    'room_ended', false,
    'remaining_members', v_remaining,
    'daily_room_url', v_room.daily_room_url
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.cowork_join_room_with_capacity(p_room_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_room record;
  v_member_count integer;
  v_max_size integer;
  v_is_existing boolean := false;
begin
  if p_room_id is null or p_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'MISSING_ARGUMENT');
  end if;

  select id, created_by, mode, max_size, status, scheduled_end_at, ended_at
    into v_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'ROOM_NOT_FOUND');
  end if;

  if coalesce(v_room.status, 'active') <> 'active' or v_room.ended_at is not null then
    return jsonb_build_object('ok', false, 'code', 'ROOM_ENDED');
  end if;

  if v_room.scheduled_end_at is not null and v_room.scheduled_end_at < now() - interval '3 minutes' then
    return jsonb_build_object('ok', false, 'code', 'ROOM_EXPIRED');
  end if;

  select exists(
    select 1 from public.room_members
    where room_id = p_room_id and user_id = p_user_id
  ) into v_is_existing;

  if v_is_existing or v_room.created_by = p_user_id then
    return jsonb_build_object('ok', true, 'already_member', true, 'member_count', null);
  end if;

  select count(*) into v_member_count
  from public.room_members
  where room_id = p_room_id;

  v_max_size := case
    when v_room.mode = 'pair' then 2
    else greatest(1, coalesce(v_room.max_size, 4))
  end;

  if v_member_count >= v_max_size then
    return jsonb_build_object(
      'ok', false,
      'code', 'ROOM_FULL',
      'member_count', v_member_count,
      'max_size', v_max_size
    );
  end if;

  insert into public.room_members(room_id, user_id)
  values (p_room_id, p_user_id)
  on conflict (room_id, user_id) do nothing;

  return jsonb_build_object(
    'ok', true,
    'already_member', false,
    'member_count', v_member_count + 1,
    'max_size', v_max_size
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.cowork_leave_room(p_room_id uuid, p_user_id uuid, p_reason text DEFAULT 'user_leave'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_room record;
  v_deleted integer := 0;
  v_remaining integer := 0;
begin
  if p_room_id is null or p_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'MISSING_ARGUMENT');
  end if;

  select id, created_by, daily_room_url, status, ended_at
    into v_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'ROOM_NOT_FOUND');
  end if;

  delete from public.room_members
  where room_id = p_room_id
    and user_id = p_user_id;

  get diagnostics v_deleted = row_count;

  update public.room_access_sessions
  set status = 'ended',
      updated_at = now(),
      last_presence_at = null
  where room_id = p_room_id
    and user_id = p_user_id
    and status = 'active';

  insert into public.room_lifecycle_events(room_id, actor_user_id, event_type, reason, metadata)
  values (
    p_room_id,
    p_user_id,
    'member_left',
    coalesce(nullif(p_reason, ''), 'user_leave'),
    jsonb_build_object('deleted_membership_rows', v_deleted)
  );

  select count(*)
    into v_remaining
  from public.room_members
  where room_id = p_room_id;

  if v_remaining <= 0 and coalesce(v_room.status, 'active') = 'active' and v_room.ended_at is null then
    update public.rooms
    set status = 'ended',
        ended_at = now(),
        last_presence_at = null,
        cleanup_reason = coalesce(cleanup_reason, 'all_members_left')
    where id = p_room_id;

    update public.room_access_sessions
    set status = 'ended',
        updated_at = now(),
        last_presence_at = null
    where room_id = p_room_id
      and status = 'active';

    insert into public.room_lifecycle_events(room_id, actor_user_id, event_type, reason, metadata)
    values (
      p_room_id,
      p_user_id,
      'room_ended',
      'all_members_left',
      jsonb_build_object('remaining_members', v_remaining)
    );

    return jsonb_build_object(
      'ok', true,
      'left', true,
      'room_ended', true,
      'remaining_members', v_remaining,
      'daily_room_url', v_room.daily_room_url
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'left', v_deleted > 0,
    'room_ended', false,
    'remaining_members', v_remaining,
    'daily_room_url', v_room.daily_room_url
  );
end;
$function$
;

grant delete on table "public"."room_access_sessions" to "anon";

grant insert on table "public"."room_access_sessions" to "anon";

grant references on table "public"."room_access_sessions" to "anon";

grant select on table "public"."room_access_sessions" to "anon";

grant trigger on table "public"."room_access_sessions" to "anon";

grant truncate on table "public"."room_access_sessions" to "anon";

grant update on table "public"."room_access_sessions" to "anon";

grant delete on table "public"."room_access_sessions" to "authenticated";

grant insert on table "public"."room_access_sessions" to "authenticated";

grant references on table "public"."room_access_sessions" to "authenticated";

grant select on table "public"."room_access_sessions" to "authenticated";

grant trigger on table "public"."room_access_sessions" to "authenticated";

grant truncate on table "public"."room_access_sessions" to "authenticated";

grant update on table "public"."room_access_sessions" to "authenticated";

grant delete on table "public"."room_access_sessions" to "service_role";

grant insert on table "public"."room_access_sessions" to "service_role";

grant references on table "public"."room_access_sessions" to "service_role";

grant select on table "public"."room_access_sessions" to "service_role";

grant trigger on table "public"."room_access_sessions" to "service_role";

grant truncate on table "public"."room_access_sessions" to "service_role";

grant update on table "public"."room_access_sessions" to "service_role";

grant delete on table "public"."room_lifecycle_events" to "anon";

grant insert on table "public"."room_lifecycle_events" to "anon";

grant references on table "public"."room_lifecycle_events" to "anon";

grant select on table "public"."room_lifecycle_events" to "anon";

grant trigger on table "public"."room_lifecycle_events" to "anon";

grant truncate on table "public"."room_lifecycle_events" to "anon";

grant update on table "public"."room_lifecycle_events" to "anon";

grant delete on table "public"."room_lifecycle_events" to "authenticated";

grant insert on table "public"."room_lifecycle_events" to "authenticated";

grant references on table "public"."room_lifecycle_events" to "authenticated";

grant select on table "public"."room_lifecycle_events" to "authenticated";

grant trigger on table "public"."room_lifecycle_events" to "authenticated";

grant truncate on table "public"."room_lifecycle_events" to "authenticated";

grant update on table "public"."room_lifecycle_events" to "authenticated";

grant delete on table "public"."room_lifecycle_events" to "service_role";

grant insert on table "public"."room_lifecycle_events" to "service_role";

grant references on table "public"."room_lifecycle_events" to "service_role";

grant select on table "public"."room_lifecycle_events" to "service_role";

grant trigger on table "public"."room_lifecycle_events" to "service_role";

grant truncate on table "public"."room_lifecycle_events" to "service_role";

grant update on table "public"."room_lifecycle_events" to "service_role";


  create policy "room_access_sessions_select_own"
  on "public"."room_access_sessions"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "room_lifecycle_events_no_direct_select"
  on "public"."room_lifecycle_events"
  as permissive
  for select
  to authenticated
using (false);



