-- DESTRUCTIVE ROLLBACK: Calm&Co P2 Rooms 299 commercial closure.
-- Do not run during normal deployment.
-- This deletes P2 entitlement, wallet, payment-application and extension history.
-- Prefer reverting application code while retaining additive schema.

begin;

-- Remove compatibility projection created by P2. This is destructive and does
-- not restore a prior legacy VIP value.
update public.user_entitlements
set plan = 'free', vip_until = null, updated_at = now()
where plan = 'rooms_unlimited_299';

drop trigger if exists trg_p2_refund_reversal
  on public.refund_requests;
drop function if exists public.cowork_p2_refund_reversal_trigger();
drop function if exists public.cowork_reverse_subscription_payment_v2(
  uuid, uuid, integer, text, jsonb
);

drop function if exists public.cowork_finalize_room_extension_v2(
  uuid, uuid, text, text, jsonb
);
drop function if exists public.cowork_apply_subscription_payment_v2(
  uuid, uuid, uuid, text, timestamptz, timestamptz, text, jsonb
);
drop function if exists public.cowork_consume_usage_wallet_v2(
  uuid, text, bigint, text, uuid, uuid, uuid, boolean, jsonb
);

alter table public.room_extension_confirmations
  drop column if exists extension_grant_id,
  drop column if exists finalization_status,
  drop column if exists finalized_at,
  drop column if exists sponsor_user_id,
  drop column if exists points_consumed,
  drop column if exists new_scheduled_end_at;

alter table public.room_access_sessions
  drop column if exists commercial_plan_code,
  drop column if exists wallet_visual_debited_seconds,
  drop column if exists wallet_visual_overage_seconds;

alter table public.subscription_profiles
  drop column if exists commercial_entitlement_status,
  drop column if exists entitlement_applied_at;

drop table if exists public.room_extension_grants cascade;
drop table if exists public.subscription_payment_applications cascade;
drop table if exists public.user_usage_wallet_events cascade;
drop table if exists public.user_usage_wallets cascade;
drop table if exists public.user_plan_entitlements cascade;

drop function if exists public.cowork_p2_touch_updated_at();

commit;
