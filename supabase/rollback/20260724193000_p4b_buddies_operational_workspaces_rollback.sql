-- P4-B rollback removes only P4-B read-path indexes.
-- It does not delete bookings, payments, disputes, settlements, payout accounts,
-- payout items, services, slots or any P3 RPC.
-- Do not run this during a normal deployment.

set lock_timeout = '15s';
set statement_timeout = '10min';

begin;

drop index if exists public.idx_p4b_buddy_bookings_buyer_schedule;
drop index if exists public.idx_p4b_buddy_bookings_provider_schedule;
drop index if exists public.idx_p4b_buddy_services_provider_status;
drop index if exists public.idx_p4b_buddy_slots_provider_schedule;
drop index if exists public.idx_p4b_buddy_disputes_booking_status;
drop index if exists public.idx_p4b_settlement_events_booking_created;

commit;
