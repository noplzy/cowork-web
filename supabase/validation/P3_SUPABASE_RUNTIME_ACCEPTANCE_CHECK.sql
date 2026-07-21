-- P3 runtime acceptance. Read-only.
-- Run after one real remote booking, ECPAY payment, provider acceptance,
-- both completion confirmations, settlement hold, payout account verification,
-- payout batch and refund/dispute smoke.
-- Replace the UUID placeholders.

-- Locate recent commercial Buddies bookings.
select id,service_id,buyer_user_id,provider_user_id,booking_status,payment_status,
       total_amount_twd,payment_order_id,settlement_id,paid_at,
       buyer_completed_at,provider_completed_at,completed_at,dispute_status,created_at
from public.buddy_bookings order by created_at desc limit 30;

with p as (select '00000000-0000-0000-0000-000000000000'::uuid booking_id)
select a.* from public.buddy_booking_payment_applications a join p on p.booking_id=a.booking_id;

with p as (select '00000000-0000-0000-0000-000000000000'::uuid booking_id)
select s.* from public.buddy_settlements s join p on p.booking_id=s.booking_id;

with p as (select '00000000-0000-0000-0000-000000000000'::uuid booking_id)
select e.event_type,e.from_status,e.to_status,e.amount_twd,e.metadata,e.created_at
from public.buddy_settlement_events e join p on p.booking_id=e.booking_id order by e.created_at;

-- Provider account contains only masked details + external secure reference.
with p as (select '00000000-0000-0000-0000-000000000000'::uuid provider_user_id)
select provider_user_id,payout_method,bank_code,account_last5,account_holder_name,status,
       secure_provider_reference is not null as external_secure_reference_present,
       verified_at,created_at,updated_at
from public.buddy_payout_accounts a join p using(provider_user_id);

-- Payout batch and items.
select * from public.buddy_payout_batches order by created_at desc limit 30;
select * from public.buddy_payout_items order by created_at desc limit 60;

-- Duplicate/idempotency checks: all queries must return zero rows.
select booking_id,count(*) from public.buddy_booking_payment_applications group by booking_id having count(*)>1;
select payment_order_id,count(*) from public.buddy_booking_payment_applications group by payment_order_id having count(*)>1;
select booking_id,count(*) from public.buddy_settlements group by booking_id having count(*)>1;
select settlement_id,count(*) from public.buddy_payout_items group by settlement_id having count(*)>1;

-- No payout must bypass completion/dispute controls. Must return zero rows.
select s.* from public.buddy_settlements s
join public.buddy_bookings b on b.id=s.booking_id
where s.status in ('releasable','payout_processing','paid_out')
  and (b.booking_status<>'completed' or b.buyer_completed_at is null or b.provider_completed_at is null);

select s.* from public.buddy_settlements s
where s.status in ('releasable','payout_processing','paid_out')
  and exists(select 1 from public.buddy_disputes d where d.booking_id=s.booking_id and d.dispute_status in ('open','reviewing'));

-- Paid booking must have exactly one settlement and application. Must return zero rows.
select b.id from public.buddy_bookings b
left join public.buddy_booking_payment_applications a on a.booking_id=b.id and a.status='applied'
left join public.buddy_settlements s on s.booking_id=b.id
where b.payment_status='paid' and (a.id is null or s.id is null);

-- Diagnostic reliability signals.
select event_type,severity,source,metadata,created_at
from public.reliability_events
where metadata->>'signal' like 'p3_buddy_%' or metadata->>'signal' like 'p3_partial_buddy_%'
order by created_at desc limit 100;
