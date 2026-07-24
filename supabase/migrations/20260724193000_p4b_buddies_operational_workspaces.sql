-- Calm&Co / 安感島 P4-B Buddies Operational Workspaces
-- Baseline: noplzy/cowork-web main @ c9e54330880be33d2f9d118e0c0098953ee5e9e8
-- Build: calmco-p4b-buddies-operational-workspaces-v141-2026-07-24
--
-- P4-B adds only read-path indexes for the buyer/provider/payout workspace.
-- It intentionally does NOT create a second payment, refund, settlement, room,
-- dispute or payout command path. P3 remains the commercial source of truth.
--
-- Browser clients still use the anon key and RLS. New workspace reads are made
-- by an authenticated Next.js route through service_role after real-name checks.
-- Never expose SUPABASE_SERVICE_ROLE_KEY to browser code.

set lock_timeout = '15s';
set statement_timeout = '10min';
set idle_in_transaction_session_timeout = '2min';

begin;

create index if not exists idx_p4b_buddy_bookings_buyer_schedule
  on public.buddy_bookings (
    buyer_user_id,
    scheduled_start_at desc,
    booking_status,
    payment_status
  );

create index if not exists idx_p4b_buddy_bookings_provider_schedule
  on public.buddy_bookings (
    provider_user_id,
    scheduled_start_at desc,
    booking_status,
    payment_status
  );

create index if not exists idx_p4b_buddy_services_provider_status
  on public.buddy_services (
    provider_user_id,
    status,
    updated_at desc
  );

create index if not exists idx_p4b_buddy_slots_provider_schedule
  on public.buddy_service_slots (
    provider_user_id,
    starts_at,
    slot_status
  );

create index if not exists idx_p4b_buddy_disputes_booking_status
  on public.buddy_disputes (
    booking_id,
    dispute_status,
    created_at desc
  );

create index if not exists idx_p4b_settlement_events_booking_created
  on public.buddy_settlement_events (
    booking_id,
    created_at desc
  );

commit;
