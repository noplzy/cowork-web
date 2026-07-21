-- DESTRUCTIVE P3 rollback. DO NOT RUN during normal deployment.
-- This drops P3 commercial Buddies settlement/payout data and columns.
-- Prefer reverting application code while keeping additive schema.
begin;

drop index if exists public.idx_billing_ledger_buddy_payment_unique;

delete from public.billing_ledger where buddy_booking_id is not null and ledger_type in ('buddy_payment','buddy_provider_payable','buddy_refund','buddy_provider_payable_reversal','buddy_payout');
alter table public.billing_ledger drop constraint if exists billing_ledger_type_check;
alter table public.billing_ledger add constraint billing_ledger_type_check check (ledger_type in ('payment','refund','entitlement_grant','room_credit','host_credit','buddy_charge','buddy_payout','invoice','manual_adjustment','other')) not valid;
alter table public.billing_ledger validate constraint billing_ledger_type_check;

drop trigger if exists trg_p3_buddy_refund_reversal on public.refund_requests;
drop function if exists public.cowork_p3_refund_reversal_trigger();
drop function if exists public.cowork_transition_buddy_payout_batch_v3(uuid,uuid,text,text,text);
drop function if exists public.cowork_resolve_buddy_dispute_v3(uuid,uuid,text,text,text);
drop function if exists public.cowork_create_buddy_payout_batch_v3(uuid,uuid,uuid[],text);
drop function if exists public.cowork_promote_buddy_settlements_v3(integer);
drop function if exists public.cowork_expire_unpaid_buddy_bookings_v3(integer);
drop function if exists public.cowork_finish_buddy_room_provision_v3(uuid,uuid,uuid,text,text);
drop function if exists public.cowork_claim_buddy_room_provision_v3(uuid,uuid,integer,integer);
drop function if exists public.cowork_reverse_buddy_payment_v3(uuid,uuid,integer);
drop function if exists public.cowork_release_buddy_settlement_v3(uuid,uuid,text);
drop function if exists public.cowork_hold_buddy_settlement_v3(uuid,uuid,text,uuid);
drop function if exists public.cowork_confirm_buddy_completion_v3(uuid,uuid,integer);
drop function if exists public.cowork_transition_buddy_booking_v3(uuid,uuid,text,text,uuid,text);
drop function if exists public.cowork_apply_buddy_payment_v3(uuid,uuid,uuid,integer,timestamptz,jsonb);
drop function if exists public.cowork_create_buddy_booking_v3(uuid,uuid,uuid,text,integer);
drop function if exists public.calmco_p3_touch_updated_at();

drop table if exists public.buddy_payout_items cascade;
drop table if exists public.buddy_payout_batches cascade;
drop table if exists public.buddy_payout_accounts cascade;
drop table if exists public.buddy_settlement_events cascade;
drop table if exists public.buddy_settlements cascade;
drop table if exists public.buddy_booking_payment_applications cascade;

alter table public.buddy_bookings
  drop column if exists payment_order_id,
  drop column if exists settlement_id,
  drop column if exists payment_due_at,
  drop column if exists paid_at,
  drop column if exists payment_failed_at,
  drop column if exists room_provision_status,
  drop column if exists room_provision_claimed_at,
  drop column if exists room_provision_error;
alter table public.payment_orders drop column if exists buddy_booking_id;

commit;
