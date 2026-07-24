-- P4-A runtime acceptance. Safe/read-only.
-- Replace the three all-zero UUID strings with real values after a real room test.

with params as (
  select
    '00000000-0000-0000-0000-000000000000'::uuid as room_id,
    '00000000-0000-0000-0000-000000000000'::uuid as viewer_user_id,
    '00000000-0000-0000-0000-000000000000'::uuid as target_user_id
)
select
  r.id,
  r.title,
  r.status,
  r.created_by,
  r.started_at,
  r.scheduled_end_at,
  r.ended_at,
  greatest(0, floor(extract(epoch from (r.scheduled_end_at - now()))))::integer as remaining_seconds,
  r.cleanup_reason
from public.rooms r, params p
where r.id = p.room_id;

with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as room_id
)
select
  rm.room_id,
  rm.user_id,
  p.handle,
  p.display_name,
  p.public_profile_enabled,
  p.accepting_friend_requests,
  ps.presence_mode,
  ps.presence_status,
  ps.daily_participant_state,
  ps.last_presence_at
from public.room_members rm
join params x on x.room_id = rm.room_id
left join public.profiles p on p.user_id = rm.user_id
left join public.room_member_presence_state ps
  on ps.room_id = rm.room_id and ps.user_id = rm.user_id
order by ps.last_presence_at desc nulls last, p.display_name;

with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as viewer_user_id
)
select
  e.plan_code,
  e.status,
  e.valid_from,
  e.valid_until,
  e.auto_renew,
  e.cancel_at_period_end
from public.user_plan_entitlements e, params p
where e.user_id = p.viewer_user_id
order by e.valid_until desc;

with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as viewer_user_id
)
select
  w.resource_key,
  w.unit,
  w.granted_quantity,
  w.consumed_quantity,
  greatest(0, w.granted_quantity - w.consumed_quantity) as remaining_quantity,
  w.overage_quantity,
  w.period_start,
  w.period_end,
  w.status
from public.user_usage_wallets w, params p
where w.user_id = p.viewer_user_id
order by w.period_end desc, w.resource_key;

with params as (
  select
    '00000000-0000-0000-0000-000000000000'::uuid as viewer_user_id,
    '00000000-0000-0000-0000-000000000000'::uuid as target_user_id
)
select
  fr.id,
  fr.requester_user_id,
  fr.addressee_user_id,
  fr.status,
  fr.pair_key,
  fr.created_at,
  fr.updated_at
from public.friend_requests fr, params p
where fr.pair_key = least(p.viewer_user_id::text, p.target_user_id::text)
  || ':' || greatest(p.viewer_user_id::text, p.target_user_id::text);

with params as (
  select
    '00000000-0000-0000-0000-000000000000'::uuid as viewer_user_id,
    '00000000-0000-0000-0000-000000000000'::uuid as target_user_id
)
select f.*
from public.friendships f, params p
where f.user_low = least(p.viewer_user_id, p.target_user_id)
  and f.user_high = greatest(p.viewer_user_id, p.target_user_id);

with params as (
  select
    '00000000-0000-0000-0000-000000000000'::uuid as viewer_user_id,
    '00000000-0000-0000-0000-000000000000'::uuid as target_user_id
)
select
  b.blocker_user_id,
  b.blocked_user_id,
  b.reason,
  b.created_at
from public.user_blocks b, params p
where (b.blocker_user_id = p.viewer_user_id and b.blocked_user_id = p.target_user_id)
   or (b.blocker_user_id = p.target_user_id and b.blocked_user_id = p.viewer_user_id);

with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as room_id
)
select
  ur.id,
  ur.reporter_user_id,
  ur.target_user_id,
  ur.target_room_id,
  ur.category,
  ur.severity,
  ur.status,
  ur.created_at
from public.user_reports ur, params p
where ur.target_room_id = p.room_id
order by ur.created_at desc
limit 20;

with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as room_id
)
select
  count(*) filter (
    where ps.presence_status in ('active', 'brb', 'hidden')
      and ps.last_presence_at >= now() - interval '90 seconds'
  ) as current_presence_count,
  count(*) as projected_member_count,
  max(ps.last_presence_at) as latest_presence_at
from public.room_member_presence_state ps, params p
where ps.room_id = p.room_id;
