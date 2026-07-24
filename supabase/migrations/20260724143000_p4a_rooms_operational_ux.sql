-- Calm&Co P4-A Rooms Operational UX
-- Baseline: GitHub main 8f2b531d7d80d6dfa941ddb7b398403941c24447
-- Scope: room-scoped social actions, owner lifecycle actions, and read-model indexes.
-- Browser clients must not call these RPCs directly. Next.js routes authenticate the
-- user first, then call them through SUPABASE_SERVICE_ROLE_KEY. service_role bypasses
-- RLS, so every RPC repeats room-membership/ownership checks.

begin;

set local lock_timeout = '15s';
set local statement_timeout = '120s';

create index if not exists idx_p4a_presence_room_status_recent
  on public.room_member_presence_state(room_id, presence_status, last_presence_at desc);

create index if not exists idx_p4a_identity_approved_user
  on public.identity_verification_requests(user_id, reviewed_at desc)
  where review_status = 'approved';

create index if not exists idx_p4a_reports_room_target_created
  on public.user_reports(target_room_id, target_user_id, created_at desc)
  where target_room_id is not null;

create index if not exists idx_p4a_wallet_user_resource_period
  on public.user_usage_wallets(user_id, resource_key, period_end desc)
  where status = 'active';

create or replace function public.cowork_room_friend_action_v4a(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_room_id uuid,
  p_action text,
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_request public.friend_requests%rowtype;
  v_pair text;
  v_low uuid;
  v_high uuid;
  v_accepting boolean := true;
begin
  if p_actor_user_id is null or p_target_user_id is null or p_room_id is null then
    raise exception 'INVALID_ARGUMENT';
  end if;
  if p_actor_user_id = p_target_user_id then
    raise exception 'CANNOT_FRIEND_SELF';
  end if;
  if p_action not in ('send', 'accept', 'decline', 'cancel', 'remove') then
    raise exception 'INVALID_FRIEND_ACTION';
  end if;

  select * into v_room
  from public.rooms
  where id = p_room_id;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  if p_actor_user_id <> v_room.created_by
     and not exists (
       select 1 from public.room_members
       where room_id = p_room_id and user_id = p_actor_user_id
     ) then
    raise exception 'NOT_A_MEMBER';
  end if;

  if p_target_user_id <> v_room.created_by
     and not exists (
       select 1 from public.room_members
       where room_id = p_room_id and user_id = p_target_user_id
     ) then
    raise exception 'TARGET_NOT_IN_ROOM';
  end if;

  if exists (
    select 1
    from public.user_blocks
    where (blocker_user_id = p_actor_user_id and blocked_user_id = p_target_user_id)
       or (blocker_user_id = p_target_user_id and blocked_user_id = p_actor_user_id)
  ) then
    raise exception 'RELATIONSHIP_UNAVAILABLE';
  end if;

  if p_actor_user_id < p_target_user_id then
    v_low := p_actor_user_id;
    v_high := p_target_user_id;
  else
    v_low := p_target_user_id;
    v_high := p_actor_user_id;
  end if;
  v_pair := v_low::text || ':' || v_high::text;

  perform pg_advisory_xact_lock(hashtextextended(v_pair, 0));

  select * into v_request
  from public.friend_requests
  where pair_key = v_pair
  for update;

  if p_action = 'send' then
    if exists (
      select 1 from public.friendships
      where user_low = v_low and user_high = v_high
    ) then
      return jsonb_build_object('state', 'friend', 'pair_key', v_pair);
    end if;

    select coalesce(accepting_friend_requests, true)
      into v_accepting
    from public.profiles
    where user_id = p_target_user_id;
    if found and not v_accepting then
      raise exception 'FRIEND_REQUESTS_DISABLED';
    end if;

    if v_request.id is not null
       and v_request.status = 'pending'
       and v_request.requester_user_id = p_target_user_id
       and v_request.addressee_user_id = p_actor_user_id then
      update public.friend_requests
      set status = 'accepted', updated_at = now()
      where id = v_request.id;

      insert into public.friendships(user_low, user_high, created_at)
      values (v_low, v_high, now())
      on conflict (user_low, user_high) do nothing;

      return jsonb_build_object(
        'state', 'friend',
        'request_id', v_request.id,
        'pair_key', v_pair,
        'auto_accepted_reverse_request', true
      );
    end if;

    if v_request.id is null then
      insert into public.friend_requests(
        requester_user_id,
        addressee_user_id,
        status,
        message,
        created_at,
        updated_at
      ) values (
        p_actor_user_id,
        p_target_user_id,
        'pending',
        nullif(left(coalesce(p_message, ''), 300), ''),
        now(),
        now()
      )
      returning * into v_request;
    else
      update public.friend_requests
      set requester_user_id = p_actor_user_id,
          addressee_user_id = p_target_user_id,
          status = 'pending',
          message = nullif(left(coalesce(p_message, ''), 300), ''),
          updated_at = now()
      where id = v_request.id
      returning * into v_request;
    end if;

    return jsonb_build_object(
      'state', 'outgoing',
      'request_id', v_request.id,
      'pair_key', v_pair
    );
  end if;

  if p_action = 'accept' then
    if v_request.id is null
       or v_request.status <> 'pending'
       or v_request.requester_user_id <> p_target_user_id
       or v_request.addressee_user_id <> p_actor_user_id then
      raise exception 'FRIEND_REQUEST_NOT_FOUND';
    end if;

    update public.friend_requests
    set status = 'accepted', updated_at = now()
    where id = v_request.id;

    insert into public.friendships(user_low, user_high, created_at)
    values (v_low, v_high, now())
    on conflict (user_low, user_high) do nothing;

    return jsonb_build_object(
      'state', 'friend',
      'request_id', v_request.id,
      'pair_key', v_pair
    );
  end if;

  if p_action = 'decline' then
    if v_request.id is null
       or v_request.status <> 'pending'
       or v_request.requester_user_id <> p_target_user_id
       or v_request.addressee_user_id <> p_actor_user_id then
      raise exception 'FRIEND_REQUEST_NOT_FOUND';
    end if;

    update public.friend_requests
    set status = 'declined', updated_at = now()
    where id = v_request.id;

    return jsonb_build_object(
      'state', 'none',
      'request_id', v_request.id,
      'pair_key', v_pair
    );
  end if;

  if p_action = 'cancel' then
    if v_request.id is null
       or v_request.status <> 'pending'
       or v_request.requester_user_id <> p_actor_user_id
       or v_request.addressee_user_id <> p_target_user_id then
      raise exception 'FRIEND_REQUEST_NOT_FOUND';
    end if;

    update public.friend_requests
    set status = 'cancelled', updated_at = now()
    where id = v_request.id;

    return jsonb_build_object(
      'state', 'none',
      'request_id', v_request.id,
      'pair_key', v_pair
    );
  end if;

  delete from public.friendships
  where user_low = v_low and user_high = v_high;

  if v_request.id is not null and v_request.status = 'pending' then
    update public.friend_requests
    set status = 'cancelled', updated_at = now()
    where id = v_request.id;
  end if;

  return jsonb_build_object('state', 'none', 'pair_key', v_pair);
end;
$$;

revoke all on function public.cowork_room_friend_action_v4a(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.cowork_room_friend_action_v4a(uuid, uuid, uuid, text, text)
  to service_role;

create or replace function public.cowork_room_owner_action_v4a(
  p_owner_user_id uuid,
  p_room_id uuid,
  p_action text,
  p_target_user_id uuid default null,
  p_client_eject_confirmed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_removed_count integer := 0;
begin
  if p_owner_user_id is null or p_room_id is null then
    raise exception 'INVALID_ARGUMENT';
  end if;
  if p_action not in ('remove_member', 'end_room') then
    raise exception 'INVALID_OWNER_ACTION';
  end if;

  select * into v_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if v_room.created_by <> p_owner_user_id then
    raise exception 'NOT_ROOM_OWNER';
  end if;

  if p_action = 'end_room' then
    update public.rooms
    set status = 'ended',
        ended_at = coalesce(ended_at, now()),
        cleanup_reason = 'owner_ended_v4a',
        last_presence_at = now()
    where id = p_room_id;

    update public.room_member_presence_state
    set presence_status = 'left',
        daily_participant_state = 'left',
        last_presence_at = now(),
        updated_at = now()
    where room_id = p_room_id;

    update public.room_access_sessions
    set status = 'ended',
        disconnected_at = coalesce(disconnected_at, now()),
        updated_at = now()
    where room_id = p_room_id
      and status not in ('ended', 'expired');

    return jsonb_build_object(
      'action', 'end_room',
      'room_id', p_room_id,
      'daily_room_url', v_room.daily_room_url,
      'ended_at', now(),
      'build_tag', 'room-owner-controls-v140-2026-07-24'
    );
  end if;

  if p_target_user_id is null then
    raise exception 'TARGET_REQUIRED';
  end if;
  if p_target_user_id = p_owner_user_id then
    raise exception 'OWNER_CANNOT_REMOVE_SELF';
  end if;
  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = p_target_user_id
  ) then
    raise exception 'TARGET_NOT_IN_ROOM';
  end if;

  if not p_client_eject_confirmed and exists (
    select 1
    from public.room_member_presence_state
    where room_id = p_room_id
      and user_id = p_target_user_id
      and presence_status in ('active', 'brb', 'hidden')
      and last_presence_at >= now() - interval '90 seconds'
  ) then
    raise exception 'DAILY_EJECT_CONFIRMATION_REQUIRED';
  end if;

  -- The custom Daily call owner must eject an actively connected target first.
  -- The boolean is a verifiable hand-off signal from the client action. Offline
  -- members can still be removed without a live Daily session.
  delete from public.room_members
  where room_id = p_room_id and user_id = p_target_user_id;
  get diagnostics v_removed_count = row_count;

  update public.room_member_presence_state
  set presence_status = 'left',
      daily_participant_state = 'ejected',
      last_presence_at = now(),
      updated_at = now()
  where room_id = p_room_id and user_id = p_target_user_id;

  update public.room_access_sessions
  set status = 'ended',
      disconnected_at = coalesce(disconnected_at, now()),
      updated_at = now()
  where room_id = p_room_id
    and user_id = p_target_user_id
    and status not in ('ended', 'expired');

  return jsonb_build_object(
    'action', 'remove_member',
    'room_id', p_room_id,
    'target_user_id', p_target_user_id,
    'removed_count', v_removed_count,
    'client_eject_confirmed', p_client_eject_confirmed,
    'build_tag', 'room-owner-controls-v140-2026-07-24'
  );
end;
$$;

revoke all on function public.cowork_room_owner_action_v4a(uuid, uuid, text, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.cowork_room_owner_action_v4a(uuid, uuid, text, uuid, boolean)
  to service_role;

comment on function public.cowork_room_friend_action_v4a(uuid, uuid, uuid, text, text)
  is 'P4-A service-role-only atomic room friend state transition. Next.js must authenticate the actor first.';
comment on function public.cowork_room_owner_action_v4a(uuid, uuid, text, uuid, boolean)
  is 'P4-A service-role-only owner room end/member removal transition. Active Daily eject is performed by the custom call owner before membership revocation.';

commit;
