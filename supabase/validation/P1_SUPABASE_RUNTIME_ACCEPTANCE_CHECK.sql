-- Calm&Co / 安感島 P1 runtime acceptance check (read-only).
-- Run after a real user appeal and admin review test.
-- Replace the all-zero UUID placeholders.

-- ---------------------------------------------------------------------------
-- A. Find recent candidate appeals
-- ---------------------------------------------------------------------------
select
  id as appeal_id,
  user_id,
  moderation_case_id,
  moderation_action_id,
  resolution_action_id,
  status,
  reason_code,
  decision,
  created_at,
  updated_at
from public.appeals
order by updated_at desc
limit 30;

-- ---------------------------------------------------------------------------
-- B. Inspect one appeal lifecycle
-- ---------------------------------------------------------------------------
with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as appeal_id
)
select
  a.id,
  a.user_id,
  a.moderation_case_id,
  a.moderation_action_id,
  a.resolution_action_id,
  a.status,
  a.reason_code,
  a.requested_outcome,
  a.decision,
  a.admin_response,
  a.decision_reason,
  a.review_started_at,
  a.resolved_at,
  a.closed_at,
  a.last_user_message_at,
  a.last_admin_message_at,
  a.version,
  a.created_at,
  a.updated_at
from public.appeals a
join params p on p.appeal_id = a.id;

with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as appeal_id
)
select
  m.id,
  m.sender_role,
  m.sender_user_id,
  m.body,
  m.metadata,
  m.created_at
from public.appeal_messages m
join params p on p.appeal_id = m.appeal_id
order by m.created_at;

with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as appeal_id
)
select
  e.id,
  e.actor_role,
  e.actor_user_id,
  e.event_type,
  e.from_status,
  e.to_status,
  e.metadata,
  e.created_at
from public.appeal_events e
join params p on p.appeal_id = e.appeal_id
order by e.created_at;

-- ---------------------------------------------------------------------------
-- C. Restore and moderation linkage
-- For an accepted appeal where restore was requested:
-- - resolution_action_id must not be null
-- - linked action_type must equal restore
-- - repeated saving must not create another restore action for the appeal
-- ---------------------------------------------------------------------------
with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as appeal_id
)
select
  a.id as appeal_id,
  a.status,
  a.resolution_action_id,
  original_action.action_type as original_action_type,
  restore_action.action_type as resolution_action_type,
  restore_action.reason as resolution_reason,
  restore_action.created_at as resolution_created_at
from public.appeals a
join params p on p.appeal_id = a.id
left join public.moderation_actions original_action on original_action.id = a.moderation_action_id
left join public.moderation_actions restore_action on restore_action.id = a.resolution_action_id;

with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as appeal_id
)
select
  ma.metadata ->> 'appeal_id' as appeal_id,
  count(*) as restore_action_count
from public.moderation_actions ma
join params p on ma.metadata ->> 'appeal_id' = p.appeal_id::text
where ma.action_type = 'restore'
group by ma.metadata ->> 'appeal_id';
-- Expected restore_action_count: 0 when no restore requested, otherwise exactly 1.

-- ---------------------------------------------------------------------------
-- D. Duplicate protection. Every query must return zero rows.
-- ---------------------------------------------------------------------------
select user_id, moderation_action_id, count(*) as duplicate_count
from public.appeals
where moderation_action_id is not null
  and status in ('open', 'reviewing')
group by user_id, moderation_action_id
having count(*) > 1;

select user_id, moderation_case_id, count(*) as duplicate_count
from public.appeals
where moderation_action_id is null
  and moderation_case_id is not null
  and status in ('open', 'reviewing')
group by user_id, moderation_case_id
having count(*) > 1;

select user_id, idempotency_key, count(*) as duplicate_count
from public.appeals
where idempotency_key is not null
group by user_id, idempotency_key
having count(*) > 1;

select metadata ->> 'appeal_id' as appeal_id, count(*) as duplicate_restore_count
from public.moderation_actions
where action_type = 'restore'
  and metadata ->> 'source' = 'appeal_resolution'
group by metadata ->> 'appeal_id'
having count(*) > 1;

-- ---------------------------------------------------------------------------
-- E. Audit and notification signals for one appeal
-- ---------------------------------------------------------------------------
with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as appeal_id
)
select
  action_type,
  actor_admin_user_id,
  metadata,
  created_at
from public.admin_audit_logs l
join params p on l.target_id = p.appeal_id::text
where l.target_type = 'appeal'
order by l.created_at;

with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as appeal_id
)
select
  template_key,
  channel,
  status,
  subject,
  body,
  dedupe_key,
  created_at,
  sent_at
from public.notification_outbox n
join params p on n.target_id = p.appeal_id::text
where n.target_type = 'appeal'
order by n.created_at;

-- ---------------------------------------------------------------------------
-- F. Recent permission-denial evidence cannot be proven from SQL alone.
-- Validate the role matrix through HTTP and confirm denied requests return 403
-- with code ADMIN_PERMISSION_FORBIDDEN.
-- ---------------------------------------------------------------------------
