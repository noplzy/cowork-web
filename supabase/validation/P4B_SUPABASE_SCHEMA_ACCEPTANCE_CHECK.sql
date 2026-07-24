-- Calm&Co P4-B Supabase schema acceptance
-- Safe read-only verification. No temporary table and no data changes.

with checks as (
  select
    'table buddy_bookings exists'::text as check_name,
    to_regclass('public.buddy_bookings') is not null as passed,
    coalesce(to_regclass('public.buddy_bookings')::text, 'missing') as detail
  union all
  select 'table buddy_services exists', to_regclass('public.buddy_services') is not null,
    coalesce(to_regclass('public.buddy_services')::text, 'missing')
  union all
  select 'table buddy_service_slots exists', to_regclass('public.buddy_service_slots') is not null,
    coalesce(to_regclass('public.buddy_service_slots')::text, 'missing')
  union all
  select 'table buddy_settlements exists', to_regclass('public.buddy_settlements') is not null,
    coalesce(to_regclass('public.buddy_settlements')::text, 'missing')
  union all
  select 'table buddy_settlement_events exists', to_regclass('public.buddy_settlement_events') is not null,
    coalesce(to_regclass('public.buddy_settlement_events')::text, 'missing')
  union all
  select 'table buddy_disputes exists', to_regclass('public.buddy_disputes') is not null,
    coalesce(to_regclass('public.buddy_disputes')::text, 'missing')
  union all
  select 'table buddy_payout_accounts exists', to_regclass('public.buddy_payout_accounts') is not null,
    coalesce(to_regclass('public.buddy_payout_accounts')::text, 'missing')
  union all
  select 'table buddy_payout_items exists', to_regclass('public.buddy_payout_items') is not null,
    coalesce(to_regclass('public.buddy_payout_items')::text, 'missing')
  union all
  select 'P3 create booking RPC exists', exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'cowork_create_buddy_booking_v3'
    ), 'cowork_create_buddy_booking_v3'
  union all
  select 'P3 transition booking RPC exists', exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'cowork_transition_buddy_booking_v3'
    ), 'cowork_transition_buddy_booking_v3'
  union all
  select 'P3 completion RPC exists', exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'cowork_confirm_buddy_completion_v3'
    ), 'cowork_confirm_buddy_completion_v3'
  union all
  select 'P3 room claim RPC exists', exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'cowork_claim_buddy_room_provision_v3'
    ), 'cowork_claim_buddy_room_provision_v3'
  union all
  select 'P3 settlement RLS enabled', coalesce((
      select c.relrowsecurity
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'buddy_settlements'
    ), false), 'buddy_settlements.relrowsecurity'
  union all
  select 'anon cannot select buddy_settlements', not has_table_privilege('anon', 'public.buddy_settlements', 'SELECT'),
    'anon SELECT should be false'
  union all
  select 'authenticated cannot select buddy_settlements', not has_table_privilege('authenticated', 'public.buddy_settlements', 'SELECT'),
    'authenticated SELECT should be false'
  union all
  select 'index buyer workspace', to_regclass('public.idx_p4b_buddy_bookings_buyer_schedule') is not null,
    coalesce(to_regclass('public.idx_p4b_buddy_bookings_buyer_schedule')::text, 'missing')
  union all
  select 'index provider workspace', to_regclass('public.idx_p4b_buddy_bookings_provider_schedule') is not null,
    coalesce(to_regclass('public.idx_p4b_buddy_bookings_provider_schedule')::text, 'missing')
  union all
  select 'index provider services', to_regclass('public.idx_p4b_buddy_services_provider_status') is not null,
    coalesce(to_regclass('public.idx_p4b_buddy_services_provider_status')::text, 'missing')
  union all
  select 'index provider slots', to_regclass('public.idx_p4b_buddy_slots_provider_schedule') is not null,
    coalesce(to_regclass('public.idx_p4b_buddy_slots_provider_schedule')::text, 'missing')
  union all
  select 'index disputes', to_regclass('public.idx_p4b_buddy_disputes_booking_status') is not null,
    coalesce(to_regclass('public.idx_p4b_buddy_disputes_booking_status')::text, 'missing')
  union all
  select 'index settlement events', to_regclass('public.idx_p4b_settlement_events_booking_created') is not null,
    coalesce(to_regclass('public.idx_p4b_settlement_events_booking_created')::text, 'missing')
)
select jsonb_build_object(
  'P4B_SUPABASE_SCHEMA_ACCEPTANCE',
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
