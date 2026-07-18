-- Calm&Co / 安感島 P0
-- Presence State Closure + Room Post-Session Summary + RTC usage fields
-- Build tag: calmco-p0-presence-summary-v128-2026-07-18
--
-- Security model:
-- - All tables below have RLS enabled.
-- - No browser-facing policies are created in this migration.
-- - The Next.js server routes use SUPABASE_SERVICE_ROLE_KEY and therefore bypass RLS.
-- - Do not expose SUPABASE_SERVICE_ROLE_KEY to the client.

begin;

create or replace function public.cowork_p0_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.room_member_presence_state (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_session_id uuid references public.room_access_sessions(id) on delete set null,
  presence_mode text not null default 'quiet',
  presence_status text not null default 'active',
  last_event_type text not null default 'selected',
  last_heartbeat_at timestamptz,
  last_visible_at timestamptz,
  last_hidden_at timestamptz,
  audio_track_state text not null default 'off',
  video_track_state text not null default 'off',
  screen_track_state text not null default 'off',
  daily_participant_state text not null default 'unknown',
  billing_media_class text not null default 'unknown',
  brb_started_at timestamptz,
  brb_until timestamptz,
  brb_returned_at timestamptz,
  extension_confirmed_at timestamptz,
  last_presence_at timestamptz,
  connected_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id),
  constraint room_member_presence_state_mode_check
    check (presence_mode in ('quiet', 'audio', 'mosaic', 'camera')),
  constraint room_member_presence_state_status_check
    check (presence_status in ('active', 'hidden', 'brb', 'left', 'disconnected')),
  constraint room_member_presence_state_track_check
    check (
      audio_track_state in ('on', 'off', 'unknown') and
      video_track_state in ('on', 'off', 'unknown') and
      screen_track_state in ('on', 'off', 'unknown')
    ),
  constraint room_member_presence_state_daily_check
    check (daily_participant_state in ('unknown', 'joining', 'joined', 'left', 'error')),
  constraint room_member_presence_state_media_check
    check (billing_media_class in ('unknown', 'no_media', 'audio_only', 'video'))
);

alter table public.room_member_presence_state enable row level security;

create index if not exists idx_room_member_presence_state_room_updated
  on public.room_member_presence_state (room_id, updated_at desc);
create index if not exists idx_room_member_presence_state_user_updated
  on public.room_member_presence_state (user_id, updated_at desc);
create index if not exists idx_room_member_presence_state_brb
  on public.room_member_presence_state (presence_status, brb_until)
  where presence_status = 'brb';

drop trigger if exists trg_room_member_presence_state_updated_at
  on public.room_member_presence_state;
create trigger trg_room_member_presence_state_updated_at
before update on public.room_member_presence_state
for each row execute function public.cowork_p0_touch_updated_at();

create table if not exists public.room_extension_confirmations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_session_id uuid references public.room_access_sessions(id) on delete set null,
  extension_window_key text not null,
  decision text not null,
  requested_extension_minutes integer not null default 25,
  is_rooms_entitled boolean not null default false,
  sponsor_points_required integer not null default 0,
  current_scheduled_end_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_extension_confirmations_decision_check
    check (decision in ('continue', 'leave')),
  constraint room_extension_confirmations_minutes_check
    check (requested_extension_minutes = 25),
  constraint room_extension_confirmations_points_check
    check (sponsor_points_required >= 0),
  unique (room_id, user_id, extension_window_key)
);

alter table public.room_extension_confirmations enable row level security;

create index if not exists idx_room_extension_confirmations_room_window
  on public.room_extension_confirmations (room_id, extension_window_key, created_at desc);

drop trigger if exists trg_room_extension_confirmations_updated_at
  on public.room_extension_confirmations;
create trigger trg_room_extension_confirmations_updated_at
before update on public.room_extension_confirmations
for each row execute function public.cowork_p0_touch_updated_at();

create table if not exists public.room_session_summaries (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  summary_version text not null,
  room_title text,
  room_category text,
  room_mode text,
  visibility text,
  scheduled_duration_minutes integer not null default 0,
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  actual_started_at timestamptz,
  actual_ended_at timestamptz,
  end_reason text,
  participant_count integer not null default 0,
  connected_participant_count integer not null default 0,
  total_presence_seconds bigint not null default 0,
  total_participant_minutes numeric(14, 4) not null default 0,
  total_visual_seconds bigint not null default 0,
  total_audio_only_seconds bigint not null default 0,
  estimated_provider_cost_usd numeric(14, 6) not null default 0,
  source_event_count integer not null default 0,
  source_access_session_count integer not null default 0,
  status text not null default 'ready',
  last_error text,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_session_summaries_status_check
    check (status in ('pending', 'ready', 'failed'))
);

alter table public.room_session_summaries enable row level security;

create index if not exists idx_room_session_summaries_generated
  on public.room_session_summaries (generated_at desc);
create index if not exists idx_room_session_summaries_status
  on public.room_session_summaries (status, updated_at desc);

drop trigger if exists trg_room_session_summaries_updated_at
  on public.room_session_summaries;
create trigger trg_room_session_summaries_updated_at
before update on public.room_session_summaries
for each row execute function public.cowork_p0_touch_updated_at();

create table if not exists public.room_participant_summaries (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_session_id uuid references public.room_access_sessions(id) on delete set null,
  presence_mode text not null default 'quiet',
  first_presence_at timestamptz,
  last_presence_at timestamptz,
  actual_presence_seconds bigint not null default 0,
  participant_minutes numeric(14, 4) not null default 0,
  visual_seconds bigint not null default 0,
  audio_only_seconds bigint not null default 0,
  screen_share_seconds bigint not null default 0,
  billing_media_class text not null default 'unknown',
  joined_confirmed boolean not null default false,
  left_explicitly boolean not null default false,
  brb_count integer not null default 0,
  hidden_count integer not null default 0,
  extension_confirm_count integer not null default 0,
  reliability_event_count integer not null default 0,
  estimated_provider_cost_usd numeric(14, 6) not null default 0,
  summary_version text not null,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id),
  constraint room_participant_summaries_mode_check
    check (presence_mode in ('quiet', 'audio', 'mosaic', 'camera')),
  constraint room_participant_summaries_media_check
    check (billing_media_class in ('unknown', 'no_media', 'audio_only', 'video'))
);

alter table public.room_participant_summaries enable row level security;

create index if not exists idx_room_participant_summaries_user_generated
  on public.room_participant_summaries (user_id, generated_at desc);
create index if not exists idx_room_participant_summaries_room_generated
  on public.room_participant_summaries (room_id, generated_at desc);

drop trigger if exists trg_room_participant_summaries_updated_at
  on public.room_participant_summaries;
create trigger trg_room_participant_summaries_updated_at
before update on public.room_participant_summaries
for each row execute function public.cowork_p0_touch_updated_at();

alter table public.room_presence_events
  add column if not exists daily_participant_state text,
  add column if not exists billing_media_class text;

alter table public.room_access_sessions
  add column if not exists connected_at timestamptz,
  add column if not exists disconnected_at timestamptz,
  add column if not exists connected_seconds bigint not null default 0,
  add column if not exists visual_seconds bigint not null default 0,
  add column if not exists audio_only_seconds bigint not null default 0,
  add column if not exists screen_share_seconds bigint not null default 0,
  add column if not exists billing_media_class text not null default 'unknown',
  add column if not exists billable_participant_minutes numeric(14, 4) not null default 0,
  add column if not exists estimated_provider_cost_usd numeric(14, 6) not null default 0,
  add column if not exists usage_status text not null default 'pending',
  add column if not exists reconciled_at timestamptz,
  add column if not exists reconciliation_source text;

create index if not exists idx_room_access_sessions_usage_status
  on public.room_access_sessions (usage_status, updated_at desc);
create index if not exists idx_room_access_sessions_user_connected
  on public.room_access_sessions (user_id, connected_at desc);

comment on table public.room_member_presence_state is
  'P0 current-state projection. Event history remains in room_presence_events; this table is the current operational state.';
comment on table public.room_session_summaries is
  'Idempotent room-level post-session summary. Does not store transcript, raw audio, or video.';
comment on table public.room_participant_summaries is
  'Per-participant session summary calculated from heartbeat/media state events and access sessions.';
comment on table public.room_extension_confirmations is
  'P0 extension confirmation only. Commercial point consumption/final extension remains server-gated and must not be inferred from this table alone.';

commit;

begin;

drop function if exists public.cowork_apply_presence_usage(
  uuid, integer, text, boolean, boolean
);
drop function if exists public.cowork_apply_presence_usage(
  uuid, integer, text, text, boolean, boolean
);

create function public.cowork_apply_presence_usage(
  p_access_session_id uuid,
  p_delta_seconds integer,
  p_interval_media_class text,
  p_current_media_class text,
  p_screen_share_on boolean,
  p_connected boolean
)
returns public.room_access_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.room_access_sessions;
  v_delta integer := least(greatest(coalesce(p_delta_seconds, 0), 0), 90);
  v_interval_media text := case
    when p_interval_media_class = 'video' then 'video'
    when p_interval_media_class = 'audio_only' then 'audio_only'
    when p_interval_media_class = 'no_media' then 'no_media'
    else 'unknown'
  end;
  v_current_media text := case
    when p_current_media_class = 'video' then 'video'
    when p_current_media_class = 'audio_only' then 'audio_only'
    when p_current_media_class = 'no_media' then 'no_media'
    else 'unknown'
  end;
begin
  update public.room_access_sessions
  set
    connected_at = case
      when p_connected and connected_at is null then now()
      else connected_at
    end,
    disconnected_at = case
      when p_connected then null
      else now()
    end,
    connected_seconds = connected_seconds + v_delta,
    visual_seconds = visual_seconds + case
      when v_interval_media = 'video' then v_delta
      else 0
    end,
    audio_only_seconds = audio_only_seconds + case
      when v_interval_media in ('audio_only', 'no_media') then v_delta
      else 0
    end,
    screen_share_seconds = screen_share_seconds + case
      when coalesce(p_screen_share_on, false) then v_delta
      else 0
    end,
    billing_media_class = case
      when billing_media_class = 'video'
        or v_interval_media = 'video'
        or v_current_media = 'video'
        then 'video'
      when billing_media_class = 'audio_only'
        or v_interval_media = 'audio_only'
        or v_current_media = 'audio_only'
        then 'audio_only'
      when billing_media_class = 'no_media'
        or v_interval_media = 'no_media'
        or v_current_media = 'no_media'
        then 'no_media'
      else 'unknown'
    end,
    billable_participant_minutes = round(
      ((connected_seconds + v_delta)::numeric / 60.0),
      4
    ),
    usage_status = case when p_connected then 'connected' else 'closed' end,
    updated_at = now()
  where id = p_access_session_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'ROOM_ACCESS_SESSION_NOT_FOUND';
  end if;

  return v_row;
end;
$$;

revoke all on function public.cowork_apply_presence_usage(
  uuid, integer, text, text, boolean, boolean
) from public, anon, authenticated;
grant execute on function public.cowork_apply_presence_usage(
  uuid, integer, text, text, boolean, boolean
) to service_role;

commit;
