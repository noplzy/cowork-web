-- Calm&Co / 安感島 P2 Runtime Acceptance
-- Safe: read-only.
-- Run after a real NT$299 staging subscription payment, room presence test,
-- visual quota test, extension confirmation and extension finalization.
-- Replace the UUID placeholders.

-- 1. Recent Rooms 299 subscriptions and entitlement application.
select
  sp.id as subscription_profile_id,
  sp.user_id,
  sp.plan_code,
  sp.status,
  sp.current_period_start,
  sp.current_period_end,
  sp.next_charge_at,
  sp.commercial_entitlement_status,
  sp.entitlement_applied_at,
  upe.status as entitlement_status,
  upe.valid_from,
  upe.valid_until,
  upe.cancel_at_period_end
from public.subscription_profiles sp
left join public.user_plan_entitlements upe
  on upe.source_subscription_profile_id = sp.id
where sp.plan_code = 'rooms_unlimited_299'
order by sp.created_at desc
limit 20;

-- 2. Replace USER_UUID. Expected active visual_seconds=72000 and
-- extension_points=12 for the current paid period before consumption.
with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as user_id
)
select
  w.id,
  w.plan_code,
  w.resource_key,
  w.unit,
  w.period_start,
  w.period_end,
  w.granted_quantity,
  w.consumed_quantity,
  w.overage_quantity,
  greatest(w.granted_quantity - w.consumed_quantity, 0) as remaining_quantity,
  w.status
from public.user_usage_wallets w
join params p on p.user_id = w.user_id
order by w.period_end desc, w.resource_key;

-- 3. Payment application must be exactly once per payment order.
select payment_order_id, count(*) as duplicate_count
from public.subscription_payment_applications
group by payment_order_id
having count(*) > 1;

-- 4. Wallet idempotency must have no duplicates.
select user_id, idempotency_key, count(*) as duplicate_count
from public.user_usage_wallet_events
group by user_id, idempotency_key
having count(*) > 1;

-- 5. Replace ROOM_UUID and USER_UUID. Observe visual debit and access session.
with params as (
  select
    '00000000-0000-0000-0000-000000000000'::uuid as room_id,
    '00000000-0000-0000-0000-000000000000'::uuid as user_id
)
select
  ras.id,
  ras.room_id,
  ras.user_id,
  ras.billing_session_key,
  ras.entitlement_source,
  ras.commercial_plan_code,
  ras.connected_seconds,
  ras.visual_seconds,
  ras.wallet_visual_debited_seconds,
  ras.wallet_visual_overage_seconds,
  ras.charge_status,
  ras.token_exp,
  ras.updated_at
from public.room_access_sessions ras
join params p on p.room_id = ras.room_id and p.user_id = ras.user_id
order by ras.created_at desc;

-- 6. Replace ROOM_UUID. Expected at most one applied extension in P2 pilot.
with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as room_id
)
select
  g.id,
  g.room_id,
  g.extension_window_key,
  g.sponsor_user_id,
  g.beneficiary_user_ids,
  g.points_consumed,
  g.previous_scheduled_end_at,
  g.new_scheduled_end_at,
  g.status,
  g.created_at
from public.room_extension_grants g
join params p on p.room_id = g.room_id
order by g.created_at;

select room_id, count(*) as applied_extension_count
from public.room_extension_grants
where status = 'applied'
group by room_id
having count(*) > 1;

-- 7. Every applied grant should match the authoritative room end.
select
  g.room_id,
  g.new_scheduled_end_at,
  r.scheduled_end_at,
  (g.new_scheduled_end_at = r.scheduled_end_at) as room_end_matches
from public.room_extension_grants g
join public.rooms r on r.id = g.room_id
where g.status = 'applied'
order by g.created_at desc
limit 20;

-- 8. P3 plans must have no applied P2 payment applications.
select *
from public.subscription_payment_applications
where plan_code in ('buddies_pro_399', 'whole_site_599', 'host_999');

-- 9. Full-refund reversal integrity.
-- Expected for every fully refunded P2 payment:
-- - subscription_payment_applications.status = reversed
-- - matching entitlement status = refunded, unless a later payment is current
-- - wallets funded by that payment are refunded
-- - one rooms_access revoke event exists
select
  rr.id as refund_request_id,
  rr.payment_order_id,
  rr.amount_twd as refund_amount_twd,
  po.amount as order_amount_twd,
  spa.status as application_status,
  spa.reversed_at,
  spa.reversal_refund_request_id,
  upe.status as current_entitlement_status,
  count(uw.id) filter (where uw.status = 'refunded') as refunded_wallet_count,
  count(uw.id) as wallet_count,
  exists (
    select 1
    from public.entitlement_events ee
    where ee.payment_order_id = rr.payment_order_id
      and ee.event_type = 'revoke'
      and ee.entitlement_key = 'rooms_access'
  ) as has_revoke_event
from public.refund_requests rr
join public.payment_orders po
  on po.id = rr.payment_order_id
left join public.subscription_payment_applications spa
  on spa.payment_order_id = rr.payment_order_id
left join public.user_plan_entitlements upe
  on upe.user_id = spa.user_id
 and upe.plan_code = spa.plan_code
 and upe.source_payment_order_id = spa.payment_order_id
left join public.user_usage_wallets uw
  on uw.source_payment_order_id = rr.payment_order_id
where rr.status = 'refunded'
  and po.plan_code = 'rooms_unlimited_299'
  and coalesce(rr.amount_twd, po.amount) >= po.amount
group by
  rr.id,
  rr.payment_order_id,
  rr.amount_twd,
  po.amount,
  spa.status,
  spa.reversed_at,
  spa.reversal_refund_request_id,
  upe.status
order by rr.resolved_at desc nulls last;

-- This query should return zero rows.
select
  rr.id as refund_request_id,
  rr.payment_order_id,
  spa.status as application_status,
  spa.reversed_at,
  spa.reversal_refund_request_id
from public.refund_requests rr
join public.payment_orders po
  on po.id = rr.payment_order_id
left join public.subscription_payment_applications spa
  on spa.payment_order_id = rr.payment_order_id
where rr.status = 'refunded'
  and po.plan_code = 'rooms_unlimited_299'
  and coalesce(rr.amount_twd, po.amount) >= po.amount
  and (
    spa.payment_order_id is null
    or spa.status <> 'reversed'
    or spa.reversed_at is null
    or spa.reversal_refund_request_id is distinct from rr.id
  );

-- 10. Refund-reversal reliability signals.
-- Any returned row requires manual review.
select
  id,
  user_id,
  event_type,
  severity,
  source,
  metadata,
  created_at
from public.reliability_events
where event_type in (
  'p2_refund_entitlement_reversal_failed',
  'p2_partial_subscription_refund_requires_manual_entitlement_review'
)
order by created_at desc
limit 50;
