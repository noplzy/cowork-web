-- Calm&Co / 安感島 P2
-- Rooms 299 controlled commercial closure:
-- subscription payment -> entitlement -> visual wallet -> extension wallet -> room extension
-- Build tag: calmco-p2-rooms-299-commercial-v130-2026-07-20
--
-- Security model:
-- - Browser clients do not receive direct table or RPC access.
-- - Next.js server routes use SUPABASE_SERVICE_ROLE_KEY and therefore bypass RLS.
-- - All mutation RPCs are service_role only.
-- - Buddies 399 / Whole Site 599 / Host 999 remain commercially blocked until P3.

begin;

create or replace function public.cowork_p2_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.user_plan_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null,
  status text not null default 'active',
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  auto_renew boolean not null default false,
  cancel_at_period_end boolean not null default false,
  source_subscription_profile_id uuid references public.subscription_profiles(id) on delete set null,
  source_payment_order_id uuid references public.payment_orders(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_plan_entitlements_plan_check
    check (plan_code in (
      'rooms_unlimited_299',
      'buddies_pro_399',
      'whole_site_599',
      'host_999'
    )),
  constraint user_plan_entitlements_status_check
    check (status in (
      'active',
      'past_due',
      'cancel_pending',
      'cancelled',
      'expired',
      'refunded'
    )),
  constraint user_plan_entitlements_period_check
    check (valid_until > valid_from),
  unique (user_id, plan_code)
);

alter table public.user_plan_entitlements enable row level security;

create index if not exists idx_user_plan_entitlements_user_active
  on public.user_plan_entitlements (user_id, status, valid_until desc);
create index if not exists idx_user_plan_entitlements_profile
  on public.user_plan_entitlements (source_subscription_profile_id)
  where source_subscription_profile_id is not null;

drop trigger if exists trg_user_plan_entitlements_updated_at
  on public.user_plan_entitlements;
create trigger trg_user_plan_entitlements_updated_at
before update on public.user_plan_entitlements
for each row execute function public.cowork_p2_touch_updated_at();

create table if not exists public.user_usage_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null,
  resource_key text not null,
  unit text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  granted_quantity bigint not null default 0,
  consumed_quantity bigint not null default 0,
  overage_quantity bigint not null default 0,
  status text not null default 'active',
  source_subscription_profile_id uuid references public.subscription_profiles(id) on delete set null,
  source_payment_order_id uuid references public.payment_orders(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_usage_wallets_plan_check
    check (plan_code in (
      'rooms_unlimited_299',
      'buddies_pro_399',
      'whole_site_599',
      'host_999'
    )),
  constraint user_usage_wallets_resource_check
    check (resource_key in (
      'visual_seconds',
      'extension_points',
      'priority_waitlist_uses',
      'tracked_buddies',
      'max_buddy_services',
      'exposure_credits'
    )),
  constraint user_usage_wallets_unit_check
    check (unit in ('seconds', 'points', 'uses', 'items')),
  constraint user_usage_wallets_status_check
    check (status in ('active', 'expired', 'revoked', 'refunded')),
  constraint user_usage_wallets_quantity_check
    check (
      granted_quantity >= 0 and
      consumed_quantity >= 0 and
      overage_quantity >= 0
    ),
  constraint user_usage_wallets_period_check
    check (period_end > period_start),
  unique (user_id, plan_code, resource_key, period_start, period_end)
);

alter table public.user_usage_wallets enable row level security;

create index if not exists idx_user_usage_wallets_user_period
  on public.user_usage_wallets (user_id, status, period_end desc);
create index if not exists idx_user_usage_wallets_resource_period
  on public.user_usage_wallets (resource_key, status, period_end desc);

drop trigger if exists trg_user_usage_wallets_updated_at
  on public.user_usage_wallets;
create trigger trg_user_usage_wallets_updated_at
before update on public.user_usage_wallets
for each row execute function public.cowork_p2_touch_updated_at();

create table if not exists public.user_usage_wallet_events (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid references public.user_usage_wallets(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  resource_key text not null,
  delta_quantity bigint not null default 0,
  overage_delta bigint not null default 0,
  balance_after bigint not null default 0,
  idempotency_key text not null,
  payment_order_id uuid references public.payment_orders(id) on delete set null,
  room_id uuid references public.rooms(id) on delete set null,
  access_session_id uuid references public.room_access_sessions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint user_usage_wallet_events_type_check
    check (event_type in (
      'grant',
      'consume',
      'overage',
      'denied',
      'adjustment',
      'refund',
      'expire'
    )),
  constraint user_usage_wallet_events_resource_check
    check (resource_key in (
      'visual_seconds',
      'extension_points',
      'priority_waitlist_uses',
      'tracked_buddies',
      'max_buddy_services',
      'exposure_credits'
    )),
  unique (user_id, idempotency_key)
);

alter table public.user_usage_wallet_events enable row level security;

create index if not exists idx_user_usage_wallet_events_user_created
  on public.user_usage_wallet_events (user_id, created_at desc);
create index if not exists idx_user_usage_wallet_events_room_created
  on public.user_usage_wallet_events (room_id, created_at desc)
  where room_id is not null;

create table if not exists public.subscription_payment_applications (
  payment_order_id uuid primary key references public.payment_orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_profile_id uuid references public.subscription_profiles(id) on delete set null,
  plan_code text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null default 'applied',
  metadata jsonb not null default '{}'::jsonb,
  applied_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversal_refund_request_id uuid references public.refund_requests(id) on delete set null,
  constraint subscription_payment_applications_plan_check
    check (plan_code in (
      'rooms_unlimited_299',
      'buddies_pro_399',
      'whole_site_599',
      'host_999'
    )),
  constraint subscription_payment_applications_status_check
    check (status in ('applied', 'reversed', 'failed')),
  constraint subscription_payment_applications_period_check
    check (period_end > period_start)
);

alter table public.subscription_payment_applications enable row level security;

create index if not exists idx_subscription_payment_applications_user
  on public.subscription_payment_applications (user_id, applied_at desc);

create table if not exists public.room_extension_grants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  extension_window_key text not null,
  sponsor_user_id uuid not null references auth.users(id) on delete cascade,
  sponsor_wallet_id uuid references public.user_usage_wallets(id) on delete set null,
  beneficiary_user_ids uuid[] not null default '{}'::uuid[],
  points_consumed integer not null default 0,
  requested_extension_minutes integer not null default 25,
  previous_scheduled_end_at timestamptz not null,
  new_scheduled_end_at timestamptz not null,
  status text not null default 'applied',
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_extension_grants_minutes_check
    check (requested_extension_minutes = 25),
  constraint room_extension_grants_points_check
    check (points_consumed >= 0),
  constraint room_extension_grants_status_check
    check (status in ('applied', 'reversed', 'failed')),
  constraint room_extension_grants_period_check
    check (new_scheduled_end_at > previous_scheduled_end_at),
  unique (room_id, extension_window_key),
  unique (idempotency_key)
);

alter table public.room_extension_grants enable row level security;

create index if not exists idx_room_extension_grants_room_created
  on public.room_extension_grants (room_id, created_at desc);
create index if not exists idx_room_extension_grants_sponsor_created
  on public.room_extension_grants (sponsor_user_id, created_at desc);

drop trigger if exists trg_room_extension_grants_updated_at
  on public.room_extension_grants;
create trigger trg_room_extension_grants_updated_at
before update on public.room_extension_grants
for each row execute function public.cowork_p2_touch_updated_at();

alter table public.subscription_profiles
  add column if not exists commercial_entitlement_status text,
  add column if not exists entitlement_applied_at timestamptz;

alter table public.room_access_sessions
  add column if not exists commercial_plan_code text,
  add column if not exists wallet_visual_debited_seconds bigint not null default 0,
  add column if not exists wallet_visual_overage_seconds bigint not null default 0;

alter table public.room_extension_confirmations
  add column if not exists extension_grant_id uuid references public.room_extension_grants(id) on delete set null,
  add column if not exists finalization_status text,
  add column if not exists finalized_at timestamptz,
  add column if not exists sponsor_user_id uuid references auth.users(id) on delete set null,
  add column if not exists points_consumed integer not null default 0,
  add column if not exists new_scheduled_end_at timestamptz;

comment on table public.user_plan_entitlements is
  'P2 current commercial entitlement projection. Browser direct access is denied; server APIs return safe projections.';
comment on table public.user_usage_wallets is
  'P2 period wallet for visual seconds and extension points. Immutable history is stored in user_usage_wallet_events.';
comment on table public.room_extension_grants is
  'P2 server-authoritative room extension result. P2 pilot allows one 25-minute commercial extension per room.';
comment on table public.subscription_payment_applications is
  'Idempotency boundary between a paid recurring payment order and entitlement/wallet grants.';

-- Existing legacy tables were generated with broad grants in older remote-schema
-- migrations. P2 explicitly removes browser access from all new commercial tables.
revoke all on table public.user_plan_entitlements from public, anon, authenticated;
revoke all on table public.user_usage_wallets from public, anon, authenticated;
revoke all on table public.user_usage_wallet_events from public, anon, authenticated;
revoke all on table public.subscription_payment_applications from public, anon, authenticated;
revoke all on table public.room_extension_grants from public, anon, authenticated;

-- Existing recurring tables previously had broad browser grants. P2 routes use
-- the service-role client and return safe projections, so direct browser access
-- is removed to protect provider payloads, admin notes and task internals.
revoke all on table public.subscription_profiles from public, anon, authenticated;
revoke all on table public.subscription_events from public, anon, authenticated;
revoke all on table public.ecpay_subscription_tasks from public, anon, authenticated;

grant all on table public.user_plan_entitlements to service_role;
grant all on table public.user_usage_wallets to service_role;
grant all on table public.user_usage_wallet_events to service_role;
grant all on table public.subscription_payment_applications to service_role;
grant all on table public.room_extension_grants to service_role;
grant all on table public.subscription_profiles to service_role;
grant all on table public.subscription_events to service_role;
grant all on table public.ecpay_subscription_tasks to service_role;

commit;

begin;

create or replace function public.cowork_consume_usage_wallet_v2(
  p_user_id uuid,
  p_resource_key text,
  p_quantity bigint,
  p_idempotency_key text,
  p_room_id uuid default null,
  p_access_session_id uuid default null,
  p_payment_order_id uuid default null,
  p_allow_overage boolean default false,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_wallet public.user_usage_wallets%rowtype;
  v_existing public.user_usage_wallet_events%rowtype;
  v_remaining bigint;
  v_consumed bigint := 0;
  v_overage bigint := 0;
  v_allowed boolean := false;
  v_event_type text := 'denied';
begin
  if p_user_id is null then
    raise exception 'P2_WALLET_USER_REQUIRED';
  end if;
  if p_resource_key not in ('visual_seconds', 'extension_points') then
    raise exception 'P2_WALLET_RESOURCE_NOT_SUPPORTED';
  end if;
  if coalesce(p_quantity, 0) <= 0 then
    raise exception 'P2_WALLET_QUANTITY_INVALID';
  end if;
  if nullif(trim(coalesce(p_idempotency_key, '')), '') is null then
    raise exception 'P2_WALLET_IDEMPOTENCY_REQUIRED';
  end if;

  select *
    into v_existing
  from public.user_usage_wallet_events
  where user_id = p_user_id
    and idempotency_key = p_idempotency_key
  limit 1;

  if found then
    return jsonb_build_object(
      'allowed', v_existing.event_type = 'consume',
      'idempotent', true,
      'event_id', v_existing.id,
      'wallet_id', v_existing.wallet_id,
      'resource_key', v_existing.resource_key,
      'consumed_quantity', v_existing.delta_quantity,
      'overage_quantity', v_existing.overage_delta,
      'remaining_quantity', v_existing.balance_after
    );
  end if;

  select w.*
    into v_wallet
  from public.user_usage_wallets w
  join public.user_plan_entitlements e
    on e.user_id = w.user_id
   and e.plan_code = w.plan_code
   and e.status in ('active', 'cancel_pending')
   and e.valid_from <= now()
   and e.valid_until > now()
  where w.user_id = p_user_id
    and w.resource_key = p_resource_key
    and w.status = 'active'
    and w.period_start <= now()
    and w.period_end > now()
  order by
    case w.plan_code
      when 'host_999' then 4
      when 'whole_site_599' then 3
      when 'rooms_unlimited_299' then 2
      else 1
    end desc,
    w.period_end desc
  limit 1
  for update of w;

  if not found then
    insert into public.user_usage_wallet_events (
      wallet_id,
      user_id,
      event_type,
      resource_key,
      delta_quantity,
      overage_delta,
      balance_after,
      idempotency_key,
      payment_order_id,
      room_id,
      access_session_id,
      metadata
    )
    values (
      null,
      p_user_id,
      'denied',
      p_resource_key,
      0,
      0,
      0,
      p_idempotency_key,
      p_payment_order_id,
      p_room_id,
      p_access_session_id,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('reason', 'wallet_not_found')
    )
    returning * into v_existing;

    return jsonb_build_object(
      'allowed', false,
      'idempotent', false,
      'reason', 'wallet_not_found',
      'event_id', v_existing.id,
      'resource_key', p_resource_key,
      'remaining_quantity', 0
    );
  end if;

  v_remaining := greatest(v_wallet.granted_quantity - v_wallet.consumed_quantity, 0);

  if v_remaining >= p_quantity then
    v_allowed := true;
    v_consumed := p_quantity;
    v_event_type := 'consume';
  elsif p_allow_overage then
    v_allowed := false;
    v_consumed := v_remaining;
    v_overage := p_quantity - v_remaining;
    v_event_type := 'overage';
  else
    v_allowed := false;
    v_consumed := 0;
    v_overage := 0;
    v_event_type := 'denied';
  end if;

  update public.user_usage_wallets
  set
    consumed_quantity = consumed_quantity + v_consumed,
    overage_quantity = overage_quantity + v_overage,
    updated_at = now()
  where id = v_wallet.id
  returning * into v_wallet;

  insert into public.user_usage_wallet_events (
    wallet_id,
    user_id,
    event_type,
    resource_key,
    delta_quantity,
    overage_delta,
    balance_after,
    idempotency_key,
    payment_order_id,
    room_id,
    access_session_id,
    metadata
  )
  values (
    v_wallet.id,
    p_user_id,
    v_event_type,
    p_resource_key,
    v_consumed,
    v_overage,
    greatest(v_wallet.granted_quantity - v_wallet.consumed_quantity, 0),
    p_idempotency_key,
    p_payment_order_id,
    p_room_id,
    p_access_session_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_existing;

  return jsonb_build_object(
    'allowed', v_allowed,
    'idempotent', false,
    'event_id', v_existing.id,
    'wallet_id', v_wallet.id,
    'plan_code', v_wallet.plan_code,
    'resource_key', v_wallet.resource_key,
    'consumed_quantity', v_consumed,
    'overage_quantity', v_overage,
    'remaining_quantity', greatest(v_wallet.granted_quantity - v_wallet.consumed_quantity, 0),
    'period_end', v_wallet.period_end
  );
exception
  when unique_violation then
    select *
      into v_existing
    from public.user_usage_wallet_events
    where user_id = p_user_id
      and idempotency_key = p_idempotency_key
    limit 1;

    if found then
      return jsonb_build_object(
        'allowed', v_existing.event_type = 'consume',
        'idempotent', true,
        'event_id', v_existing.id,
        'wallet_id', v_existing.wallet_id,
        'resource_key', v_existing.resource_key,
        'consumed_quantity', v_existing.delta_quantity,
        'overage_quantity', v_existing.overage_delta,
        'remaining_quantity', v_existing.balance_after
      );
    end if;
    raise;
end;
$$;

create or replace function public.cowork_apply_subscription_payment_v2(
  p_payment_order_id uuid,
  p_user_id uuid,
  p_subscription_profile_id uuid,
  p_plan_code text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_source text default 'ecpay_recurring_notify_v130',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.payment_orders%rowtype;
  v_profile public.subscription_profiles%rowtype;
  v_existing public.subscription_payment_applications%rowtype;
  v_entitlement public.user_plan_entitlements%rowtype;
  v_wallet public.user_usage_wallets%rowtype;
  v_event_type text := 'grant';
  v_visual_grant bigint := 0;
  v_extension_grant bigint := 0;
begin
  if p_payment_order_id is null or p_user_id is null or p_subscription_profile_id is null then
    raise exception 'P2_PAYMENT_APPLICATION_IDENTIFIERS_REQUIRED';
  end if;
  if p_plan_code <> 'rooms_unlimited_299' then
    raise exception 'P2_PLAN_BLOCKED_UNTIL_P3';
  end if;
  if p_period_start is null or p_period_end is null or p_period_end <= p_period_start then
    raise exception 'P2_PAYMENT_PERIOD_INVALID';
  end if;

  select *
    into v_existing
  from public.subscription_payment_applications
  where payment_order_id = p_payment_order_id
  limit 1;

  if found then
    return jsonb_build_object(
      'applied', true,
      'idempotent', true,
      'payment_order_id', v_existing.payment_order_id,
      'plan_code', v_existing.plan_code,
      'period_start', v_existing.period_start,
      'period_end', v_existing.period_end
    );
  end if;

  select *
    into v_order
  from public.payment_orders
  where id = p_payment_order_id
  for update;

  if not found then
    raise exception 'P2_PAYMENT_ORDER_NOT_FOUND';
  end if;
  if v_order.user_id is distinct from p_user_id then
    raise exception 'P2_PAYMENT_ORDER_USER_MISMATCH';
  end if;
  if v_order.status <> 'paid' then
    raise exception 'P2_PAYMENT_ORDER_NOT_PAID';
  end if;
  if v_order.plan_code is distinct from p_plan_code then
    raise exception 'P2_PAYMENT_ORDER_PLAN_MISMATCH';
  end if;
  if coalesce(v_order.amount, 0) <> 299 then
    raise exception 'P2_PAYMENT_ORDER_AMOUNT_MISMATCH';
  end if;

  select *
    into v_profile
  from public.subscription_profiles
  where id = p_subscription_profile_id
  for update;

  if not found then
    raise exception 'P2_SUBSCRIPTION_PROFILE_NOT_FOUND';
  end if;
  if v_profile.user_id is distinct from p_user_id then
    raise exception 'P2_SUBSCRIPTION_PROFILE_USER_MISMATCH';
  end if;
  if v_profile.plan_code is distinct from p_plan_code then
    raise exception 'P2_SUBSCRIPTION_PROFILE_PLAN_MISMATCH';
  end if;

  if exists (
    select 1
    from public.user_plan_entitlements
    where user_id = p_user_id
      and plan_code = p_plan_code
  ) then
    v_event_type := 'extend';
  end if;

  insert into public.subscription_payment_applications (
    payment_order_id,
    user_id,
    subscription_profile_id,
    plan_code,
    period_start,
    period_end,
    status,
    metadata
  )
  values (
    p_payment_order_id,
    p_user_id,
    p_subscription_profile_id,
    p_plan_code,
    p_period_start,
    p_period_end,
    'applied',
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('source', p_source)
  );

  insert into public.user_plan_entitlements (
    user_id,
    plan_code,
    status,
    valid_from,
    valid_until,
    auto_renew,
    cancel_at_period_end,
    source_subscription_profile_id,
    source_payment_order_id,
    metadata
  )
  values (
    p_user_id,
    p_plan_code,
    'active',
    p_period_start,
    p_period_end,
    true,
    false,
    p_subscription_profile_id,
    p_payment_order_id,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('source', p_source)
  )
  on conflict (user_id, plan_code)
  do update set
    status = 'active',
    valid_from = excluded.valid_from,
    valid_until = excluded.valid_until,
    auto_renew = true,
    cancel_at_period_end = false,
    source_subscription_profile_id = excluded.source_subscription_profile_id,
    source_payment_order_id = excluded.source_payment_order_id,
    metadata = public.user_plan_entitlements.metadata || excluded.metadata,
    updated_at = now()
  returning * into v_entitlement;

  -- Compatibility projection for existing room/token code while P2 is rolled out.
  insert into public.user_entitlements (user_id, plan, vip_until, updated_at)
  values (p_user_id, p_plan_code, p_period_end, now())
  on conflict (user_id)
  do update set
    plan = excluded.plan,
    vip_until = excluded.vip_until,
    updated_at = now();

  v_visual_grant := 1200 * 60;
  v_extension_grant := 12;

  insert into public.user_usage_wallets (
    user_id,
    plan_code,
    resource_key,
    unit,
    period_start,
    period_end,
    granted_quantity,
    consumed_quantity,
    overage_quantity,
    status,
    source_subscription_profile_id,
    source_payment_order_id,
    metadata
  )
  values (
    p_user_id,
    p_plan_code,
    'visual_seconds',
    'seconds',
    p_period_start,
    p_period_end,
    v_visual_grant,
    0,
    0,
    'active',
    p_subscription_profile_id,
    p_payment_order_id,
    jsonb_build_object('included_minutes', 1200, 'source', p_source)
  )
  on conflict (user_id, plan_code, resource_key, period_start, period_end)
  do update set
    granted_quantity = greatest(public.user_usage_wallets.granted_quantity, excluded.granted_quantity),
    status = 'active',
    source_subscription_profile_id = excluded.source_subscription_profile_id,
    source_payment_order_id = excluded.source_payment_order_id,
    metadata = public.user_usage_wallets.metadata || excluded.metadata,
    updated_at = now()
  returning * into v_wallet;

  insert into public.user_usage_wallet_events (
    wallet_id,
    user_id,
    event_type,
    resource_key,
    delta_quantity,
    balance_after,
    idempotency_key,
    payment_order_id,
    metadata
  )
  values (
    v_wallet.id,
    p_user_id,
    'grant',
    'visual_seconds',
    v_visual_grant,
    greatest(v_wallet.granted_quantity - v_wallet.consumed_quantity, 0),
    'payment:' || p_payment_order_id::text || ':visual_seconds',
    p_payment_order_id,
    jsonb_build_object('plan_code', p_plan_code, 'period_end', p_period_end)
  )
  on conflict (user_id, idempotency_key) do nothing;

  insert into public.user_usage_wallets (
    user_id,
    plan_code,
    resource_key,
    unit,
    period_start,
    period_end,
    granted_quantity,
    consumed_quantity,
    overage_quantity,
    status,
    source_subscription_profile_id,
    source_payment_order_id,
    metadata
  )
  values (
    p_user_id,
    p_plan_code,
    'extension_points',
    'points',
    p_period_start,
    p_period_end,
    v_extension_grant,
    0,
    0,
    'active',
    p_subscription_profile_id,
    p_payment_order_id,
    jsonb_build_object('extension_minutes_per_point', 25, 'source', p_source)
  )
  on conflict (user_id, plan_code, resource_key, period_start, period_end)
  do update set
    granted_quantity = greatest(public.user_usage_wallets.granted_quantity, excluded.granted_quantity),
    status = 'active',
    source_subscription_profile_id = excluded.source_subscription_profile_id,
    source_payment_order_id = excluded.source_payment_order_id,
    metadata = public.user_usage_wallets.metadata || excluded.metadata,
    updated_at = now()
  returning * into v_wallet;

  insert into public.user_usage_wallet_events (
    wallet_id,
    user_id,
    event_type,
    resource_key,
    delta_quantity,
    balance_after,
    idempotency_key,
    payment_order_id,
    metadata
  )
  values (
    v_wallet.id,
    p_user_id,
    'grant',
    'extension_points',
    v_extension_grant,
    greatest(v_wallet.granted_quantity - v_wallet.consumed_quantity, 0),
    'payment:' || p_payment_order_id::text || ':extension_points',
    p_payment_order_id,
    jsonb_build_object('plan_code', p_plan_code, 'period_end', p_period_end)
  )
  on conflict (user_id, idempotency_key) do nothing;

  if not exists (
    select 1
    from public.entitlement_events
    where payment_order_id = p_payment_order_id
      and entitlement_key = 'rooms_access'
      and event_type = v_event_type
  ) then
    insert into public.entitlement_events (
      user_id,
      event_type,
      plan_code,
      entitlement_key,
      quantity,
      valid_from,
      valid_until,
      payment_order_id,
      metadata
    )
    values (
      p_user_id,
      v_event_type,
      p_plan_code,
      'rooms_access',
      1,
      p_period_start,
      p_period_end,
      p_payment_order_id,
      jsonb_build_object(
        'subscription_profile_id', p_subscription_profile_id,
        'source', p_source,
        'build_tag', 'commercial-entitlements-v130-2026-07-20'
      )
    );
  end if;

  update public.subscription_profiles
  set
    status = 'active',
    current_period_start = p_period_start,
    current_period_end = p_period_end,
    next_charge_at = p_period_end,
    commercial_entitlement_status = 'applied',
    entitlement_applied_at = now(),
    updated_at = now()
  where id = p_subscription_profile_id;

  return jsonb_build_object(
    'applied', true,
    'idempotent', false,
    'payment_order_id', p_payment_order_id,
    'subscription_profile_id', p_subscription_profile_id,
    'entitlement_id', v_entitlement.id,
    'plan_code', p_plan_code,
    'period_start', p_period_start,
    'period_end', p_period_end,
    'visual_seconds_granted', v_visual_grant,
    'extension_points_granted', v_extension_grant
  );
exception
  when unique_violation then
    select *
      into v_existing
    from public.subscription_payment_applications
    where payment_order_id = p_payment_order_id
    limit 1;

    if found then
      return jsonb_build_object(
        'applied', true,
        'idempotent', true,
        'payment_order_id', v_existing.payment_order_id,
        'plan_code', v_existing.plan_code,
        'period_start', v_existing.period_start,
        'period_end', v_existing.period_end
      );
    end if;
    raise;
end;
$$;

create or replace function public.cowork_finalize_room_extension_v2(
  p_room_id uuid,
  p_sponsor_user_id uuid,
  p_extension_window_key text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room public.rooms%rowtype;
  v_existing public.room_extension_grants%rowtype;
  v_grant public.room_extension_grants%rowtype;
  v_sponsor_entitled boolean := false;
  v_active_count integer := 0;
  v_missing_count integer := 0;
  v_beneficiaries uuid[] := '{}'::uuid[];
  v_points_required integer := 0;
  v_wallet_result jsonb;
  v_wallet_id uuid;
  v_new_end timestamptz;
  v_requested_end timestamptz;
  v_prior_grants integer := 0;
begin
  if p_room_id is null or p_sponsor_user_id is null then
    raise exception 'P2_EXTENSION_IDENTIFIERS_REQUIRED';
  end if;
  if nullif(trim(coalesce(p_extension_window_key, '')), '') is null then
    raise exception 'P2_EXTENSION_WINDOW_REQUIRED';
  end if;
  if nullif(trim(coalesce(p_idempotency_key, '')), '') is null then
    raise exception 'P2_EXTENSION_IDEMPOTENCY_REQUIRED';
  end if;

  select *
    into v_existing
  from public.room_extension_grants
  where idempotency_key = p_idempotency_key
     or (room_id = p_room_id and extension_window_key = p_extension_window_key)
  order by created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'applied', v_existing.status = 'applied',
      'idempotent', true,
      'grant_id', v_existing.id,
      'room_id', v_existing.room_id,
      'points_consumed', v_existing.points_consumed,
      'new_scheduled_end_at', v_existing.new_scheduled_end_at,
      'beneficiary_user_ids', v_existing.beneficiary_user_ids,
      'reload_required', true
    );
  end if;

  select *
    into v_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception 'P2_EXTENSION_ROOM_NOT_FOUND';
  end if;
  if v_room.status in ('ended', 'expired') or v_room.ended_at is not null then
    raise exception 'P2_EXTENSION_ROOM_ENDED';
  end if;
  if v_room.scheduled_end_at is null then
    raise exception 'P2_EXTENSION_ROOM_END_MISSING';
  end if;
  begin
    if left(p_extension_window_key, 4) <> 'end:' then
      raise exception 'P2_EXTENSION_WINDOW_STALE';
    end if;
    v_requested_end := substring(p_extension_window_key from 5)::timestamptz;
  exception
    when others then
      raise exception 'P2_EXTENSION_WINDOW_STALE';
  end;
  if v_requested_end is distinct from v_room.scheduled_end_at then
    raise exception 'P2_EXTENSION_WINDOW_STALE';
  end if;

  if not exists (
    select 1
    from public.room_members
    where room_id = p_room_id
      and user_id = p_sponsor_user_id
  ) and v_room.created_by is distinct from p_sponsor_user_id then
    raise exception 'P2_EXTENSION_SPONSOR_NOT_MEMBER';
  end if;

  select count(*)
    into v_prior_grants
  from public.room_extension_grants
  where room_id = p_room_id
    and status = 'applied';

  if v_prior_grants >= 1 then
    raise exception 'P2_EXTENSION_PILOT_LIMIT_REACHED';
  end if;

  select count(*)
    into v_active_count
  from public.room_member_presence_state s
  where s.room_id = p_room_id
    and s.presence_status in ('active', 'hidden', 'brb')
    and s.daily_participant_state = 'joined';

  select count(*)
    into v_missing_count
  from public.room_member_presence_state s
  where s.room_id = p_room_id
    and s.presence_status in ('active', 'hidden', 'brb')
    and s.daily_participant_state = 'joined'
    and not exists (
      select 1
      from public.room_extension_confirmations c
      where c.room_id = p_room_id
        and c.user_id = s.user_id
        and c.extension_window_key = p_extension_window_key
    );

  if v_active_count = 0 then
    raise exception 'P2_EXTENSION_NO_ACTIVE_PARTICIPANTS';
  end if;
  if v_missing_count > 0 then
    raise exception 'P2_EXTENSION_WAITING_FOR_PARTICIPANTS';
  end if;

  select coalesce(array_agg(c.user_id order by c.user_id), '{}'::uuid[])
    into v_beneficiaries
  from public.room_extension_confirmations c
  where c.room_id = p_room_id
    and c.extension_window_key = p_extension_window_key
    and c.decision = 'continue';

  if coalesce(array_length(v_beneficiaries, 1), 0) = 0 then
    raise exception 'P2_EXTENSION_NO_CONTINUE_DECISIONS';
  end if;

  select exists (
    select 1
    from public.user_plan_entitlements e
    where e.user_id = p_sponsor_user_id
      and e.plan_code in ('rooms_unlimited_299', 'whole_site_599', 'host_999')
      and e.status in ('active', 'cancel_pending')
      and e.valid_from <= now()
      and e.valid_until > now()
  ) or exists (
    select 1
    from public.user_entitlements legacy
    where legacy.user_id = p_sponsor_user_id
      and legacy.plan in ('vip', 'vip_month', 'rooms_unlimited_299', 'whole_site_599', 'host_999')
      and (legacy.vip_until is null or legacy.vip_until > now())
  )
  into v_sponsor_entitled;

  if not v_sponsor_entitled then
    raise exception 'P2_EXTENSION_SPONSOR_REQUIRES_ROOMS_ENTITLEMENT';
  end if;

  select count(*)
    into v_points_required
  from unnest(v_beneficiaries) as beneficiary(user_id)
  where not exists (
    select 1
    from public.user_plan_entitlements e
    where e.user_id = beneficiary.user_id
      and e.plan_code in ('rooms_unlimited_299', 'whole_site_599', 'host_999')
      and e.status in ('active', 'cancel_pending')
      and e.valid_from <= now()
      and e.valid_until > now()
  )
  and not exists (
    select 1
    from public.user_entitlements legacy
    where legacy.user_id = beneficiary.user_id
      and legacy.plan in ('vip', 'vip_month', 'rooms_unlimited_299', 'whole_site_599', 'host_999')
      and (legacy.vip_until is null or legacy.vip_until > now())
  );

  if v_points_required > 0 then
    v_wallet_result := public.cowork_consume_usage_wallet_v2(
      p_sponsor_user_id,
      'extension_points',
      v_points_required,
      'extension:' || p_idempotency_key,
      p_room_id,
      null,
      null,
      false,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'beneficiary_user_ids', v_beneficiaries,
        'extension_window_key', p_extension_window_key
      )
    );

    if coalesce((v_wallet_result ->> 'allowed')::boolean, false) is not true then
      raise exception 'P2_EXTENSION_POINTS_INSUFFICIENT';
    end if;

    v_wallet_id := nullif(v_wallet_result ->> 'wallet_id', '')::uuid;
  end if;

  v_new_end := v_room.scheduled_end_at + interval '25 minutes';

  update public.rooms
  set scheduled_end_at = v_new_end
  where id = p_room_id;

  insert into public.room_extension_grants (
    room_id,
    extension_window_key,
    sponsor_user_id,
    sponsor_wallet_id,
    beneficiary_user_ids,
    points_consumed,
    requested_extension_minutes,
    previous_scheduled_end_at,
    new_scheduled_end_at,
    status,
    idempotency_key,
    metadata
  )
  values (
    p_room_id,
    p_extension_window_key,
    p_sponsor_user_id,
    v_wallet_id,
    v_beneficiaries,
    v_points_required,
    25,
    v_room.scheduled_end_at,
    v_new_end,
    'applied',
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'pilot_extension_number', 1,
      'active_participant_count', v_active_count
    )
  )
  returning * into v_grant;

  update public.room_extension_confirmations
  set
    extension_grant_id = v_grant.id,
    finalization_status = 'applied',
    finalized_at = now(),
    sponsor_user_id = p_sponsor_user_id,
    points_consumed = case
      when user_id = any(v_beneficiaries) and not is_rooms_entitled then 1
      else 0
    end,
    new_scheduled_end_at = v_new_end,
    updated_at = now()
  where room_id = p_room_id
    and extension_window_key = p_extension_window_key;

  return jsonb_build_object(
    'applied', true,
    'idempotent', false,
    'grant_id', v_grant.id,
    'room_id', p_room_id,
    'points_consumed', v_points_required,
    'beneficiary_user_ids', v_beneficiaries,
    'previous_scheduled_end_at', v_room.scheduled_end_at,
    'new_scheduled_end_at', v_new_end,
    'reload_required', true,
    'pilot_limit', 'one_25_minute_extension_per_room'
  );
end;
$$;


create or replace function public.cowork_reverse_subscription_payment_v2(
  p_payment_order_id uuid,
  p_refund_request_id uuid,
  p_refund_amount_twd integer default null,
  p_source text default 'refund_provider_refunded',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_application public.subscription_payment_applications%rowtype;
  v_order public.payment_orders%rowtype;
  v_wallet public.user_usage_wallets%rowtype;
  v_refund_amount integer;
  v_entitlement_reversed boolean := false;
  v_wallet_count integer := 0;
begin
  if p_payment_order_id is null then
    raise exception 'P2_REFUND_PAYMENT_ORDER_REQUIRED';
  end if;

  select *
    into v_application
  from public.subscription_payment_applications
  where payment_order_id = p_payment_order_id
  for update;

  if not found then
    return jsonb_build_object(
      'reversed', false,
      'idempotent', false,
      'skipped', true,
      'reason', 'payment_has_no_p2_application',
      'payment_order_id', p_payment_order_id
    );
  end if;

  if v_application.status = 'reversed' then
    return jsonb_build_object(
      'reversed', true,
      'idempotent', true,
      'payment_order_id', p_payment_order_id,
      'refund_request_id', v_application.reversal_refund_request_id,
      'plan_code', v_application.plan_code
    );
  end if;

  select *
    into v_order
  from public.payment_orders
  where id = p_payment_order_id
  for update;

  if not found then
    raise exception 'P2_REFUND_PAYMENT_ORDER_NOT_FOUND';
  end if;

  v_refund_amount := coalesce(p_refund_amount_twd, v_order.amount, 0);
  if v_refund_amount < coalesce(v_order.amount, 0) then
    return jsonb_build_object(
      'reversed', false,
      'idempotent', false,
      'skipped', true,
      'reason', 'partial_refund_requires_manual_entitlement_decision',
      'payment_order_id', p_payment_order_id,
      'refund_amount_twd', v_refund_amount,
      'order_amount_twd', v_order.amount
    );
  end if;

  update public.subscription_payment_applications
  set
    status = 'reversed',
    reversed_at = now(),
    reversal_refund_request_id = p_refund_request_id,
    metadata = coalesce(metadata, '{}'::jsonb) ||
      coalesce(p_metadata, '{}'::jsonb) ||
      jsonb_build_object(
        'reversal_source', p_source,
        'refund_amount_twd', v_refund_amount,
        'reversed_at', now()
      )
  where payment_order_id = p_payment_order_id;

  update public.user_plan_entitlements
  set
    status = 'refunded',
    valid_until = greatest(
      valid_from + interval '1 second',
      least(valid_until, now())
    ),
    auto_renew = false,
    cancel_at_period_end = false,
    metadata = coalesce(metadata, '{}'::jsonb) ||
      coalesce(p_metadata, '{}'::jsonb) ||
      jsonb_build_object(
        'refunded_payment_order_id', p_payment_order_id,
        'refund_request_id', p_refund_request_id,
        'reversal_source', p_source
      ),
    updated_at = now()
  where user_id = v_application.user_id
    and plan_code = v_application.plan_code
    and source_payment_order_id = p_payment_order_id;

  get diagnostics v_wallet_count = row_count;
  v_entitlement_reversed := v_wallet_count > 0;
  v_wallet_count := 0;

  for v_wallet in
    select *
    from public.user_usage_wallets
    where source_payment_order_id = p_payment_order_id
      and status <> 'refunded'
    for update
  loop
    update public.user_usage_wallets
    set
      status = 'refunded',
      metadata = coalesce(metadata, '{}'::jsonb) ||
        coalesce(p_metadata, '{}'::jsonb) ||
        jsonb_build_object(
          'refund_request_id', p_refund_request_id,
          'reversal_source', p_source
        ),
      updated_at = now()
    where id = v_wallet.id;

    insert into public.user_usage_wallet_events (
      wallet_id,
      user_id,
      event_type,
      resource_key,
      delta_quantity,
      overage_delta,
      balance_after,
      idempotency_key,
      payment_order_id,
      metadata
    )
    values (
      v_wallet.id,
      v_wallet.user_id,
      'refund',
      v_wallet.resource_key,
      0,
      0,
      0,
      'refund:' || coalesce(p_refund_request_id::text, p_payment_order_id::text) ||
        ':' || v_wallet.id::text,
      p_payment_order_id,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'refund_request_id', p_refund_request_id,
        'plan_code', v_wallet.plan_code,
        'reversal_source', p_source,
        'previous_balance', greatest(
          v_wallet.granted_quantity - v_wallet.consumed_quantity,
          0
        )
      )
    )
    on conflict (user_id, idempotency_key) do nothing;

    v_wallet_count := v_wallet_count + 1;
  end loop;

  if v_entitlement_reversed then
    update public.user_entitlements
    set
      plan = 'free',
      vip_until = null,
      updated_at = now()
    where user_id = v_application.user_id
      and plan = v_application.plan_code
      and (
        vip_until is null or
        abs(extract(epoch from (vip_until - v_application.period_end))) < 5
      );

    update public.subscription_profiles
    set
      status = 'cancelled',
      auto_renew = false,
      next_charge_at = null,
      cancelled_at = coalesce(cancelled_at, now()),
      cancel_reason = coalesce(cancel_reason, 'full_refund'),
      commercial_entitlement_status = 'refunded',
      raw_payload = coalesce(raw_payload, '{}'::jsonb) ||
        jsonb_build_object(
          'p2_refund_reversal', jsonb_build_object(
            'payment_order_id', p_payment_order_id,
            'refund_request_id', p_refund_request_id,
            'reversed_at', now(),
            'source', p_source
          )
        ),
      updated_at = now()
    where id = v_application.subscription_profile_id;

  end if;

  -- Every fully refunded P2 payment gets a revoke event, even when a later
  -- renewal is already the current entitlement. The current projection itself
  -- is only cancelled above when it still points at this payment order.
  if not exists (
    select 1
    from public.entitlement_events
    where payment_order_id = p_payment_order_id
      and event_type = 'revoke'
      and entitlement_key = 'rooms_access'
  ) then
    insert into public.entitlement_events (
      user_id,
      event_type,
      plan_code,
      entitlement_key,
      quantity,
      valid_from,
      valid_until,
      payment_order_id,
      metadata
    )
    values (
      v_application.user_id,
      'revoke',
      v_application.plan_code,
      'rooms_access',
      1,
      v_application.period_start,
      least(
        v_application.period_end,
        greatest(v_application.period_start + interval '1 second', now())
      ),
      p_payment_order_id,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'refund_request_id', p_refund_request_id,
        'source', p_source,
        'current_projection_reversed', v_entitlement_reversed,
        'build_tag', 'commercial-entitlements-v130-2026-07-20'
      )
    );
  end if;

  return jsonb_build_object(
    'reversed', true,
    'idempotent', false,
    'payment_order_id', p_payment_order_id,
    'refund_request_id', p_refund_request_id,
    'plan_code', v_application.plan_code,
    'entitlement_reversed', v_entitlement_reversed,
    'wallets_refunded', v_wallet_count
  );
end;
$$;

create or replace function public.cowork_p2_refund_reversal_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if new.status = 'refunded'
    and old.status is distinct from new.status
    and new.payment_order_id is not null
  then
    begin
      v_result := public.cowork_reverse_subscription_payment_v2(
        new.payment_order_id,
        new.id,
        new.amount_twd,
        'refund_requests_status_trigger',
        jsonb_build_object('triggered_at', now())
      );

      if v_result ->> 'reason' = 'partial_refund_requires_manual_entitlement_decision' then
        insert into public.reliability_events (
          user_id,
          event_type,
          severity,
          source,
          metadata
        )
        values (
          new.user_id,
          'p2_partial_subscription_refund_requires_manual_entitlement_review',
          'high',
          'p2_refund_trigger',
          jsonb_build_object(
            'refund_request_id', new.id,
            'payment_order_id', new.payment_order_id,
            'result', v_result
          )
        );
      end if;
    exception
      when others then
        begin
          insert into public.reliability_events (
            user_id,
            event_type,
            severity,
            source,
            metadata
          )
          values (
            new.user_id,
            'p2_refund_entitlement_reversal_failed',
            'high',
            'p2_refund_trigger',
            jsonb_build_object(
              'refund_request_id', new.id,
              'payment_order_id', new.payment_order_id,
              'error', sqlerrm
            )
          );
        exception
          when others then
            null;
        end;
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_p2_refund_reversal
  on public.refund_requests;
create trigger trg_p2_refund_reversal
after update of status on public.refund_requests
for each row
when (new.status = 'refunded' and old.status is distinct from new.status)
execute function public.cowork_p2_refund_reversal_trigger();


revoke all on function public.cowork_consume_usage_wallet_v2(
  uuid, text, bigint, text, uuid, uuid, uuid, boolean, jsonb
) from public, anon, authenticated;
grant execute on function public.cowork_consume_usage_wallet_v2(
  uuid, text, bigint, text, uuid, uuid, uuid, boolean, jsonb
) to service_role;

revoke all on function public.cowork_apply_subscription_payment_v2(
  uuid, uuid, uuid, text, timestamptz, timestamptz, text, jsonb
) from public, anon, authenticated;
grant execute on function public.cowork_apply_subscription_payment_v2(
  uuid, uuid, uuid, text, timestamptz, timestamptz, text, jsonb
) to service_role;

revoke all on function public.cowork_finalize_room_extension_v2(
  uuid, uuid, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.cowork_finalize_room_extension_v2(
  uuid, uuid, text, text, jsonb
) to service_role;

revoke all on function public.cowork_reverse_subscription_payment_v2(
  uuid, uuid, integer, text, jsonb
) from public, anon, authenticated;
grant execute on function public.cowork_reverse_subscription_payment_v2(
  uuid, uuid, integer, text, jsonb
) to service_role;

revoke all on function public.cowork_p2_refund_reversal_trigger()
  from public, anon, authenticated;
grant execute on function public.cowork_p2_refund_reversal_trigger()
  to service_role;

commit;
