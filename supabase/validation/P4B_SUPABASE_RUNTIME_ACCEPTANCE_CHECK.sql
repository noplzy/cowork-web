-- Calm&Co P4-B runtime acceptance
-- Safe read-only verification after a real Buddies buyer/provider test.
-- Replace USER_UUID with a real buyer or provider auth.users.id before running.

-- Replace this value:
-- 00000000-0000-0000-0000-000000000000  -> USER_UUID

with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as user_id
), recent_bookings as (
  select b.*
  from public.buddy_bookings b, params p
  where b.buyer_user_id = p.user_id or b.provider_user_id = p.user_id
  order by b.created_at desc
  limit 50
)
select
  b.id,
  b.booking_status,
  b.payment_status,
  b.scheduled_start_at,
  b.scheduled_end_at,
  b.buyer_completed_at,
  b.provider_completed_at,
  b.room_provision_status,
  b.linked_room_id,
  s.title as service_title,
  st.status as settlement_status,
  st.gross_amount_twd,
  st.platform_fee_twd,
  st.provider_net_twd,
  d.dispute_status,
  b.created_at
from recent_bookings b
left join public.buddy_services s on s.id = b.service_id
left join public.buddy_settlements st on st.booking_id = b.id
left join lateral (
  select bd.dispute_status
  from public.buddy_disputes bd
  where bd.booking_id = b.id
  order by bd.created_at desc
  limit 1
) d on true
order by b.created_at desc;

with checks as (
  select
    'user_has_runtime_booking'::text as check_name,
    exists (
      select 1
      from public.buddy_bookings b
      where b.buyer_user_id = '00000000-0000-0000-0000-000000000000'::uuid
         or b.provider_user_id = '00000000-0000-0000-0000-000000000000'::uuid
    ) as passed,
    'Run after at least one real buyer/provider booking test.'::text as detail
  union all
  select
    'duplicate_active_disputes',
    not exists (
      select 1
      from public.buddy_disputes d
      where d.dispute_status in ('open', 'reviewing')
      group by d.booking_id
      having count(*) > 1
    ),
    'At most one open/reviewing dispute per booking.'
  union all
  select
    'settlement_amount_mismatch',
    not exists (
      select 1
      from public.buddy_settlements s
      where s.status not in ('refunded', 'refund_pending')
        and s.gross_amount_twd <> s.platform_fee_twd + s.provider_net_twd
    ),
    'gross_amount_twd must equal platform_fee_twd + provider_net_twd before refund.'
  union all
  select
    'paid_booking_has_settlement',
    not exists (
      select 1
      from public.buddy_bookings b
      left join public.buddy_settlements s on s.booking_id = b.id
      where b.payment_status = 'paid' and s.id is null
    ),
    'Every paid booking must have one settlement row.'
  union all
  select
    'accepted_booking_is_paid',
    not exists (
      select 1
      from public.buddy_bookings b
      where b.booking_status = 'accepted' and b.payment_status <> 'paid'
    ),
    'Provider acceptance must not bypass payment.'
  union all
  select
    'completed_requires_two_party_confirmation',
    not exists (
      select 1
      from public.buddy_bookings b
      where b.booking_status = 'completed'
        and (b.buyer_completed_at is null or b.provider_completed_at is null)
    ),
    'Completed bookings need both buyer and provider timestamps.'
  union all
  select
    'ready_room_has_linked_room',
    not exists (
      select 1
      from public.buddy_bookings b
      where b.room_provision_status = 'ready' and b.linked_room_id is null
    ),
    'room_provision_status=ready requires linked_room_id.'
  union all
  select
    'open_dispute_holds_settlement',
    not exists (
      select 1
      from public.buddy_disputes d
      join public.buddy_settlements s on s.booking_id = d.booking_id
      where d.dispute_status in ('open', 'reviewing')
        and s.status <> 'dispute_hold'
    ),
    'Open/reviewing disputes must hold payout.'
  union all
  select
    'paid_out_has_timestamp',
    not exists (
      select 1
      from public.buddy_settlements s
      where s.status = 'paid_out' and s.paid_out_at is null
    ),
    'paid_out settlements require paid_out_at.'
  union all
  select
    'raw_account_number_like_value',
    not exists (
      select 1
      from public.buddy_payout_accounts a
      where length(regexp_replace(coalesce(a.account_last5, ''), '[^0-9]', '', 'g')) > 5
         or coalesce(a.secure_provider_reference, '') ~ '[0-9]{8,}'
    ),
    'Application DB must not contain a full bank account number.'
)
select jsonb_build_object(
  'P4B_SUPABASE_RUNTIME_ACCEPTANCE',
    case when bool_and(passed) then 'PASS' else 'FAIL' end,
  'failed_checks', count(*) filter (where not passed),
  'total_checks', count(*),
  'checks', jsonb_agg(
    jsonb_build_object(
      'check_name', check_name,
      'passed', passed,
      'detail', detail
    ) order by check_name
  )
) as result
from checks;
