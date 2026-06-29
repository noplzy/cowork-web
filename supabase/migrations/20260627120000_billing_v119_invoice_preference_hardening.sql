-- Calm&Co / 安感島 billing v119 invoice preference hardening
-- Purpose:
-- 1) Make invoice preference queryable and auditable without depending only on opaque provider_payload.
-- 2) Add indexes for refund / invoice / subscription task review.
-- 3) Keep RLS enabled; server automation continues to use service_role and therefore bypasses RLS by design.

alter table public.payment_orders
  add column if not exists invoice_preference jsonb;

alter table public.subscription_profiles
  add column if not exists invoice_preference jsonb;

update public.payment_orders
set invoice_preference = provider_payload -> 'invoice_preference'
where invoice_preference is null
  and provider_payload ? 'invoice_preference';

update public.subscription_profiles
set invoice_preference = raw_payload -> 'invoice_preference'
where invoice_preference is null
  and raw_payload ? 'invoice_preference';

create index if not exists idx_payment_orders_invoice_preference_kind
  on public.payment_orders ((invoice_preference ->> 'kind'))
  where invoice_preference is not null;

create index if not exists idx_subscription_profiles_invoice_preference_kind
  on public.subscription_profiles ((invoice_preference ->> 'kind'))
  where invoice_preference is not null;

create index if not exists idx_invoice_events_payment_event_created
  on public.invoice_events (payment_order_id, event_type, created_at desc);

create index if not exists idx_ecpay_invoice_tasks_action_status_created
  on public.ecpay_invoice_tasks (action_type, status, created_at desc);

create index if not exists idx_ecpay_refund_tasks_status_created
  on public.ecpay_refund_tasks (status, created_at desc);

create index if not exists idx_refund_requests_payment_status_created
  on public.refund_requests (payment_order_id, status, created_at desc);

create index if not exists idx_ecpay_subscription_tasks_status_next_attempt
  on public.ecpay_subscription_tasks (status, next_attempt_at, created_at desc);

-- Optional default preference table. Current checkout stores per-order snapshots first;
-- this table is for account-level defaults in a later account settings page.
create table if not exists public.user_invoice_preferences (
  user_id uuid primary key,
  preference jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_invoice_preferences enable row level security;

drop policy if exists user_invoice_preferences_select_own on public.user_invoice_preferences;
create policy user_invoice_preferences_select_own
  on public.user_invoice_preferences
  for select
  using (auth.uid() = user_id);

drop policy if exists user_invoice_preferences_upsert_own on public.user_invoice_preferences;
create policy user_invoice_preferences_upsert_own
  on public.user_invoice_preferences
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
