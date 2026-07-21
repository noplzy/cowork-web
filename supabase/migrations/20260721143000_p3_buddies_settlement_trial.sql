-- Calm&Co / 安感島 P3 Buddies Settlement & Invite Trial
-- Deadlock-safe replacement for the original v131 migration.
-- Source repo baseline: noplzy/cowork-web main @ 1fd846fa03aa07a1e9f8717797310e4cd542164d
-- Build: calmco-p3-buddies-settlement-trial-v1311-2026-07-22
--
-- Why this file is staged:
-- The original file kept AccessExclusive locks on payment_orders, buddy_bookings
-- and billing_ledger inside one long transaction while creating all P3 objects.
-- Live billing/API traffic could then lock the same relations in another order,
-- producing PostgreSQL 40P01 deadlocks. This replacement commits each hot-table
-- change independently and leaves the long function creation phase after those
-- locks have been released.
--
-- Safety boundaries:
-- 1. This is an INTERNAL settlement/payable ledger, not legal escrow or trust custody.
-- 2. Raw bank account numbers MUST NOT be stored in the application database.
-- 3. Trial commercial delivery is remote-only.
-- 4. Payout is manual_verified; automated banking adapters are out of scope.
-- 5. Browser roles are revoked; server routes use service_role and must verify
--    authentication, booking-party ownership and admin permissions.
-- 6. The migration is idempotent and may be rerun after a deadlock-aborted attempt.

set lock_timeout = '15s';
set statement_timeout = '15min';
set idle_in_transaction_session_timeout = '2min';

-- ---------------------------------------------------------------------------
-- Stage 1: Create P3-owned tables first. These do not rewrite the hot legacy
-- tables and therefore should not hold AccessExclusive locks for the whole file.
-- ---------------------------------------------------------------------------
begin;

create table if not exists public.buddy_booking_payment_applications (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.buddy_bookings(id) on delete cascade,
  payment_order_id uuid not null references public.payment_orders(id) on delete cascade,
  buyer_user_id uuid not null references auth.users(id) on delete cascade,
  provider_user_id uuid not null references auth.users(id) on delete cascade,
  amount_twd integer not null default 0 check (amount_twd >= 0),
  status text not null default 'pending' check (status in ('pending','applied','reversed','failed')),
  applied_at timestamptz,
  reversed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id),
  unique (payment_order_id)
);

create table if not exists public.buddy_settlements (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.buddy_bookings(id) on delete cascade,
  payment_order_id uuid not null unique references public.payment_orders(id) on delete restrict,
  buyer_user_id uuid not null references auth.users(id) on delete restrict,
  provider_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'awaiting_payment' check (
    status in (
      'awaiting_payment','funds_held','service_accepted','completed_hold',
      'releasable','dispute_hold','refund_pending','refunded',
      'payout_processing','paid_out','manual_review'
    )
  ),
  currency text not null default 'TWD' check (currency = 'TWD'),
  gross_amount_twd integer not null default 0 check (gross_amount_twd >= 0),
  platform_fee_bps integer not null default 2000 check (platform_fee_bps between 0 and 5000),
  platform_fee_twd integer not null default 0 check (platform_fee_twd >= 0),
  provider_net_twd integer not null default 0 check (provider_net_twd >= 0),
  refund_amount_twd integer not null default 0 check (refund_amount_twd >= 0),
  available_for_payout_at timestamptz,
  payout_account_id uuid,
  payout_batch_id uuid,
  paid_out_at timestamptz,
  hold_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.buddy_settlement_events (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid references public.buddy_settlements(id) on delete cascade,
  booking_id uuid not null references public.buddy_bookings(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text not null default 'system' check (actor_role in ('buyer','provider','admin','system')),
  event_type text not null,
  from_status text,
  to_status text,
  amount_twd integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.buddy_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  provider_user_id uuid not null unique references auth.users(id) on delete cascade,
  payout_method text not null default 'manual_bank_transfer' check (payout_method = 'manual_bank_transfer'),
  bank_code text not null check (bank_code ~ '^[0-9]{3}$'),
  account_last5 text not null check (account_last5 ~ '^[0-9]{4,5}$'),
  account_holder_name text not null check (char_length(account_holder_name) between 2 and 80),
  status text not null default 'pending_review' check (status in ('pending_review','verified','rejected','suspended')),
  secure_provider_reference text,
  verified_at timestamptz,
  verified_by_admin_user_id uuid references auth.users(id) on delete set null,
  reviewer_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (secure_provider_reference is null or secure_provider_reference !~ '[0-9]{8,}')
);

create table if not exists public.buddy_payout_batches (
  id uuid primary key default gen_random_uuid(),
  provider_user_id uuid not null references auth.users(id) on delete restrict,
  payout_account_id uuid not null references public.buddy_payout_accounts(id) on delete restrict,
  status text not null default 'approved' check (status in ('approved','processing','completed','failed','cancelled')),
  currency text not null default 'TWD' check (currency = 'TWD'),
  total_items integer not null default 0 check (total_items >= 0),
  total_amount_twd integer not null default 0 check (total_amount_twd >= 0),
  created_by_admin_user_id uuid references auth.users(id) on delete set null,
  processed_by_admin_user_id uuid references auth.users(id) on delete set null,
  provider_reference text,
  note text,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  approved_at timestamptz not null default now(),
  processing_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.buddy_payout_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.buddy_payout_batches(id) on delete cascade,
  settlement_id uuid not null unique references public.buddy_settlements(id) on delete restrict,
  provider_user_id uuid not null references auth.users(id) on delete restrict,
  payout_account_id uuid not null references public.buddy_payout_accounts(id) on delete restrict,
  amount_twd integer not null check (amount_twd > 0),
  status text not null default 'queued' check (status in ('queued','processing','paid','failed','cancelled')),
  provider_reference text,
  processed_at timestamptz,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

commit;

-- ---------------------------------------------------------------------------
-- Stage 2: payment_orders hot-table change. Standalone transaction so its
-- AccessExclusive lock is released before touching buddy_bookings.
-- ---------------------------------------------------------------------------
begin;
alter table public.payment_orders add column if not exists buddy_booking_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payment_orders_buddy_booking_id_fkey') then
    alter table public.payment_orders
      add constraint payment_orders_buddy_booking_id_fkey
      foreign key (buddy_booking_id) references public.buddy_bookings(id)
      on delete set null not valid;
  end if;
end $$;
commit;

alter table public.payment_orders validate constraint payment_orders_buddy_booking_id_fkey;
create unique index if not exists idx_payment_orders_one_buddy_order
  on public.payment_orders(buddy_booking_id)
  where buddy_booking_id is not null and status in ('pending','paid');

-- ---------------------------------------------------------------------------
-- Stage 3: buddy_bookings hot-table change in its own transaction.
-- ---------------------------------------------------------------------------
begin;
alter table public.buddy_bookings
  add column if not exists payment_order_id uuid,
  add column if not exists settlement_id uuid,
  add column if not exists payment_due_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists payment_failed_at timestamptz,
  add column if not exists room_provision_status text not null default 'unprovisioned',
  add column if not exists room_provision_claimed_at timestamptz,
  add column if not exists room_provision_error text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'buddy_bookings_payment_order_id_fkey') then
    alter table public.buddy_bookings
      add constraint buddy_bookings_payment_order_id_fkey
      foreign key (payment_order_id) references public.payment_orders(id)
      on delete set null not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'buddy_bookings_settlement_id_fkey') then
    alter table public.buddy_bookings
      add constraint buddy_bookings_settlement_id_fkey
      foreign key (settlement_id) references public.buddy_settlements(id)
      on delete set null not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'buddy_bookings_room_provision_status_check') then
    alter table public.buddy_bookings
      add constraint buddy_bookings_room_provision_status_check
      check (room_provision_status in ('unprovisioned','provisioning','ready','failed')) not valid;
  end if;
end $$;
commit;

alter table public.buddy_bookings validate constraint buddy_bookings_payment_order_id_fkey;
alter table public.buddy_bookings validate constraint buddy_bookings_settlement_id_fkey;
alter table public.buddy_bookings validate constraint buddy_bookings_room_provision_status_check;
create index if not exists idx_buddy_bookings_payment_status
  on public.buddy_bookings(payment_status, booking_status, created_at desc);
create index if not exists idx_buddy_bookings_payment_due
  on public.buddy_bookings(payment_due_at)
  where payment_status = 'unpaid' and booking_status = 'pending';

-- ---------------------------------------------------------------------------
-- Stage 4: billing_ledger hot-table change, isolated from the previous locks.
-- The buddy_booking_id column is declared defensively because P3 routes and
-- ledger uniqueness depend on it.
-- ---------------------------------------------------------------------------
begin;
alter table public.billing_ledger add column if not exists buddy_booking_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'billing_ledger_buddy_booking_id_fkey') then
    alter table public.billing_ledger
      add constraint billing_ledger_buddy_booking_id_fkey
      foreign key (buddy_booking_id) references public.buddy_bookings(id)
      on delete set null not valid;
  end if;
end $$;
alter table public.billing_ledger drop constraint if exists billing_ledger_type_check;
alter table public.billing_ledger add constraint billing_ledger_type_check check (
  ledger_type in (
    'payment','refund','entitlement_grant','room_credit','host_credit','buddy_charge',
    'buddy_payout','invoice','manual_adjustment','other',
    'buddy_payment','buddy_provider_payable','buddy_refund','buddy_provider_payable_reversal'
  )
) not valid;
commit;

alter table public.billing_ledger validate constraint billing_ledger_buddy_booking_id_fkey;
alter table public.billing_ledger validate constraint billing_ledger_type_check;
create unique index if not exists idx_billing_ledger_buddy_payment_unique
  on public.billing_ledger(buddy_booking_id, ledger_type)
  where buddy_booking_id is not null
    and ledger_type in ('buddy_payment','buddy_provider_payable','buddy_refund','buddy_provider_payable_reversal','buddy_payout');

-- ---------------------------------------------------------------------------
-- Stage 5: P3 table cross-links, indexes, RLS and grants.
-- ---------------------------------------------------------------------------
begin;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'buddy_settlements_payout_account_id_fkey') then
    alter table public.buddy_settlements
      add constraint buddy_settlements_payout_account_id_fkey
      foreign key (payout_account_id) references public.buddy_payout_accounts(id)
      on delete set null not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'buddy_settlements_payout_batch_id_fkey') then
    alter table public.buddy_settlements
      add constraint buddy_settlements_payout_batch_id_fkey
      foreign key (payout_batch_id) references public.buddy_payout_batches(id)
      on delete set null not valid;
  end if;
end $$;

create index if not exists idx_buddy_settlements_status_available
  on public.buddy_settlements(status, available_for_payout_at);
create index if not exists idx_buddy_settlements_provider_created
  on public.buddy_settlements(provider_user_id, created_at desc);
create index if not exists idx_buddy_settlement_events_booking_created
  on public.buddy_settlement_events(booking_id, created_at);
create index if not exists idx_buddy_payout_accounts_status_updated
  on public.buddy_payout_accounts(status, updated_at desc);
create index if not exists idx_buddy_payout_batches_status_created
  on public.buddy_payout_batches(status, created_at desc);
create index if not exists idx_buddy_payout_items_provider_created
  on public.buddy_payout_items(provider_user_id, created_at desc);

alter table public.buddy_booking_payment_applications enable row level security;
alter table public.buddy_settlements enable row level security;
alter table public.buddy_settlement_events enable row level security;
alter table public.buddy_payout_accounts enable row level security;
alter table public.buddy_payout_batches enable row level security;
alter table public.buddy_payout_items enable row level security;

revoke all on table public.buddy_booking_payment_applications from public, anon, authenticated;
revoke all on table public.buddy_settlements from public, anon, authenticated;
revoke all on table public.buddy_settlement_events from public, anon, authenticated;
revoke all on table public.buddy_payout_accounts from public, anon, authenticated;
revoke all on table public.buddy_payout_batches from public, anon, authenticated;
revoke all on table public.buddy_payout_items from public, anon, authenticated;

grant select, insert, update, delete on table public.buddy_booking_payment_applications to service_role;
grant select, insert, update, delete on table public.buddy_settlements to service_role;
grant select, insert, update, delete on table public.buddy_settlement_events to service_role;
grant select, insert, update, delete on table public.buddy_payout_accounts to service_role;
grant select, insert, update, delete on table public.buddy_payout_batches to service_role;
grant select, insert, update, delete on table public.buddy_payout_items to service_role;
commit;

alter table public.buddy_settlements validate constraint buddy_settlements_payout_account_id_fkey;
alter table public.buddy_settlements validate constraint buddy_settlements_payout_batch_id_fkey;

-- ---------------------------------------------------------------------------
-- Stage 6: Functions and triggers. Hot-table DDL locks are already released.
-- ---------------------------------------------------------------------------
begin;
create or replace function public.calmco_p3_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_buddy_booking_payment_applications_updated_at on public.buddy_booking_payment_applications;
create trigger trg_buddy_booking_payment_applications_updated_at
before update on public.buddy_booking_payment_applications
for each row execute function public.calmco_p3_touch_updated_at();

drop trigger if exists trg_buddy_settlements_updated_at on public.buddy_settlements;
create trigger trg_buddy_settlements_updated_at
before update on public.buddy_settlements
for each row execute function public.calmco_p3_touch_updated_at();

drop trigger if exists trg_buddy_payout_accounts_updated_at on public.buddy_payout_accounts;
create trigger trg_buddy_payout_accounts_updated_at
before update on public.buddy_payout_accounts
for each row execute function public.calmco_p3_touch_updated_at();

drop trigger if exists trg_buddy_payout_batches_updated_at on public.buddy_payout_batches;
create trigger trg_buddy_payout_batches_updated_at
before update on public.buddy_payout_batches
for each row execute function public.calmco_p3_touch_updated_at();

drop trigger if exists trg_buddy_payout_items_updated_at on public.buddy_payout_items;
create trigger trg_buddy_payout_items_updated_at
before update on public.buddy_payout_items
for each row execute function public.calmco_p3_touch_updated_at();

create or replace function public.cowork_create_buddy_booking_v3(
  p_buyer_user_id uuid,
  p_service_id uuid,
  p_slot_id uuid,
  p_buyer_note text,
  p_max_amount_twd integer
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_service public.buddy_services%rowtype;
  v_slot public.buddy_service_slots%rowtype;
  v_booking public.buddy_bookings%rowtype;
  v_seconds integer;
  v_hours integer;
  v_amount integer;
begin
  if p_buyer_user_id is null then raise exception 'MISSING_BUYER'; end if;
  select * into v_service from public.buddy_services where id = p_service_id for update;
  if not found then raise exception 'BUDDY_SERVICE_NOT_FOUND'; end if;
  select * into v_slot from public.buddy_service_slots where id = p_slot_id for update;
  if not found then raise exception 'BUDDY_SLOT_NOT_FOUND'; end if;
  if v_service.provider_user_id = p_buyer_user_id then raise exception 'CANNOT_BOOK_OWN_SERVICE'; end if;
  if v_service.status <> 'active' or coalesce(v_service.accepts_new_users, true) is not true then raise exception 'SERVICE_NOT_ACTIVE'; end if;
  if v_service.delivery_mode <> 'remote' then raise exception 'P3_REMOTE_ONLY'; end if;
  if not exists (
    select 1 from public.buddy_provider_applications a
    where a.user_id = v_service.provider_user_id and a.application_status = 'approved'
  ) then raise exception 'BUDDY_PROVIDER_NOT_APPROVED'; end if;
  if v_slot.service_id is distinct from v_service.id or v_slot.provider_user_id is distinct from v_service.provider_user_id then raise exception 'SLOT_SERVICE_MISMATCH'; end if;
  if v_slot.slot_status <> 'open' then raise exception 'SLOT_NOT_OPEN'; end if;
  if v_slot.starts_at <= now() then raise exception 'SLOT_IN_PAST'; end if;
  if exists (
    select 1 from public.buddy_bookings b
    where b.slot_id = v_slot.id and b.booking_status in ('pending','accepted')
  ) then raise exception 'SLOT_ALREADY_BOOKED'; end if;
  v_seconds := extract(epoch from (v_slot.ends_at - v_slot.starts_at))::integer;
  if v_seconds <= 0 or mod(v_seconds, 3600) <> 0 then raise exception 'P3_WHOLE_HOURS_REQUIRED'; end if;
  v_hours := v_seconds / 3600;
  if v_hours < 1 or v_hours > 2 then raise exception 'P3_BOOKING_HOURS_LIMIT'; end if;
  v_amount := v_service.price_per_hour_twd * v_hours;
  if v_amount < 100 or v_amount > p_max_amount_twd then raise exception 'BUDDY_BOOKING_AMOUNT_OVER_PILOT_LIMIT'; end if;

  update public.buddy_service_slots set slot_status = 'held', updated_at = now() where id = v_slot.id;
  insert into public.buddy_bookings(
    service_id, slot_id, buyer_user_id, provider_user_id,
    scheduled_start_at, scheduled_end_at, hours_booked, total_amount_twd,
    booking_status, payment_status, buyer_note, payment_due_at
  ) values (
    v_service.id, v_slot.id, p_buyer_user_id, v_service.provider_user_id,
    v_slot.starts_at, v_slot.ends_at, v_hours, v_amount,
    'pending', 'unpaid', nullif(trim(p_buyer_note), ''), now() + interval '30 minutes'
  ) returning * into v_booking;

  insert into public.buddy_booking_events(booking_id, actor_user_id, event_type, metadata)
  values(v_booking.id, p_buyer_user_id, 'commercial_booking_created', jsonb_build_object(
    'amount_twd', v_amount, 'payment_due_at', v_booking.payment_due_at,
    'build_tag', 'buddy-settlement-ledger-v131-2026-07-21'
  ));
  return jsonb_build_object('booking', to_jsonb(v_booking), 'created', true);
end;
$$;

create or replace function public.cowork_apply_buddy_payment_v3(
  p_payment_order_id uuid,
  p_booking_id uuid,
  p_buyer_user_id uuid,
  p_platform_fee_bps integer,
  p_paid_at timestamptz,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.buddy_bookings%rowtype;
  v_order public.payment_orders%rowtype;
  v_application public.buddy_booking_payment_applications%rowtype;
  v_settlement public.buddy_settlements%rowtype;
  v_fee integer;
  v_net integer;
  v_existing boolean := false;
begin
  select * into v_booking from public.buddy_bookings where id = p_booking_id for update;
  if not found then raise exception 'BUDDY_BOOKING_NOT_FOUND'; end if;
  select * into v_order from public.payment_orders where id = p_payment_order_id for update;
  if not found then raise exception 'PAYMENT_ORDER_NOT_FOUND'; end if;
  if v_booking.buyer_user_id is distinct from p_buyer_user_id or v_order.user_id is distinct from p_buyer_user_id then raise exception 'BUDDY_PAYMENT_BUYER_MISMATCH'; end if;
  if v_order.buddy_booking_id is distinct from v_booking.id then raise exception 'BUDDY_PAYMENT_BOOKING_MISMATCH'; end if;
  if v_order.status <> 'paid' then raise exception 'BUDDY_PAYMENT_ORDER_NOT_PAID'; end if;
  if v_order.amount <> v_booking.total_amount_twd then raise exception 'BUDDY_PAYMENT_AMOUNT_MISMATCH'; end if;
  if p_platform_fee_bps < 0 or p_platform_fee_bps > 5000 then raise exception 'INVALID_PLATFORM_FEE_BPS'; end if;

  select * into v_application from public.buddy_booking_payment_applications where booking_id = v_booking.id for update;
  if found and v_application.status = 'applied' then
    select * into v_settlement from public.buddy_settlements where booking_id = v_booking.id;
    return jsonb_build_object('application', to_jsonb(v_application), 'settlement', to_jsonb(v_settlement), 'applied', false);
  end if;

  v_fee := round(v_booking.total_amount_twd * p_platform_fee_bps / 10000.0)::integer;
  v_net := greatest(0, v_booking.total_amount_twd - v_fee);

  insert into public.buddy_booking_payment_applications(
    booking_id,payment_order_id,buyer_user_id,provider_user_id,amount_twd,status,applied_at,metadata
  ) values (
    v_booking.id,v_order.id,v_booking.buyer_user_id,v_booking.provider_user_id,
    v_booking.total_amount_twd,'applied',coalesce(p_paid_at,now()),coalesce(p_metadata,'{}'::jsonb)
  ) on conflict (booking_id) do update set
    payment_order_id=excluded.payment_order_id, amount_twd=excluded.amount_twd,
    status='applied', applied_at=excluded.applied_at, reversed_at=null,
    metadata=public.buddy_booking_payment_applications.metadata || excluded.metadata,
    updated_at=now()
  returning * into v_application;

  insert into public.buddy_settlements(
    booking_id,payment_order_id,buyer_user_id,provider_user_id,status,
    gross_amount_twd,platform_fee_bps,platform_fee_twd,provider_net_twd,metadata
  ) values (
    v_booking.id,v_order.id,v_booking.buyer_user_id,v_booking.provider_user_id,'funds_held',
    v_booking.total_amount_twd,p_platform_fee_bps,v_fee,v_net,coalesce(p_metadata,'{}'::jsonb)
  ) on conflict (booking_id) do update set
    payment_order_id=excluded.payment_order_id,status='funds_held',
    gross_amount_twd=excluded.gross_amount_twd,platform_fee_bps=excluded.platform_fee_bps,
    platform_fee_twd=excluded.platform_fee_twd,provider_net_twd=excluded.provider_net_twd,
    refund_amount_twd=0,hold_reason=null,metadata=public.buddy_settlements.metadata || excluded.metadata,
    updated_at=now()
  returning * into v_settlement;

  update public.buddy_bookings set
    payment_status='paid', payment_order_id=v_order.id, settlement_id=v_settlement.id,
    paid_at=coalesce(p_paid_at,now()), payment_failed_at=null, updated_at=now()
  where id=v_booking.id;

  insert into public.buddy_settlement_events(settlement_id,booking_id,actor_user_id,actor_role,event_type,from_status,to_status,amount_twd,metadata)
  values(v_settlement.id,v_booking.id,v_booking.buyer_user_id,'buyer','payment_applied','awaiting_payment','funds_held',v_booking.total_amount_twd,coalesce(p_metadata,'{}'::jsonb));

  insert into public.billing_ledger(user_id,provider,ledger_type,direction,amount_twd,currency,payment_order_id,buddy_booking_id,description,metadata)
  values(v_booking.buyer_user_id,'ecpay','buddy_payment','credit',v_booking.total_amount_twd,'TWD',v_order.id,v_booking.id,'Buddies 預約付款',jsonb_build_object('settlement_id',v_settlement.id))
  on conflict do nothing;
  insert into public.billing_ledger(user_id,provider,ledger_type,direction,amount_twd,currency,payment_order_id,buddy_booking_id,description,metadata)
  values(v_booking.provider_user_id,'internal','buddy_provider_payable','none',v_net,'TWD',v_order.id,v_booking.id,'Buddies 提供者應付帳款',jsonb_build_object('settlement_id',v_settlement.id,'platform_fee_twd',v_fee))
  on conflict do nothing;

  return jsonb_build_object('application',to_jsonb(v_application),'settlement',to_jsonb(v_settlement),'applied',true);
end;
$$;

create or replace function public.cowork_transition_buddy_booking_v3(
  p_booking_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_note text,
  p_linked_room_id uuid,
  p_linked_room_invite_code text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.buddy_bookings%rowtype;
  v_settlement public.buddy_settlements%rowtype;
  v_from text;
  v_next text;
begin
  select * into v_booking from public.buddy_bookings where id=p_booking_id for update;
  if not found then raise exception 'BUDDY_BOOKING_NOT_FOUND'; end if;
  v_from := v_booking.booking_status;
  if p_action = 'accept' then
    if p_actor_user_id is distinct from v_booking.provider_user_id then raise exception 'ONLY_PROVIDER_CAN_ACCEPT'; end if;
    if v_booking.booking_status <> 'pending' then raise exception 'BOOKING_NOT_PENDING'; end if;
    if v_booking.payment_status <> 'paid' then raise exception 'BUDDY_BOOKING_UNPAID'; end if;
    v_next := 'accepted';
    update public.buddy_bookings set booking_status='accepted',accepted_at=coalesce(accepted_at,now()),provider_note=nullif(trim(p_note),''),linked_room_id=coalesce(p_linked_room_id,linked_room_id),linked_room_invite_code=coalesce(p_linked_room_invite_code,linked_room_invite_code),room_provision_status=case when p_linked_room_id is not null then 'ready' else 'unprovisioned' end,room_provision_error=null,updated_at=now() where id=p_booking_id returning * into v_booking;
    update public.buddy_service_slots set slot_status='booked',updated_at=now() where id=v_booking.slot_id;
    update public.buddy_settlements set status='service_accepted',updated_at=now() where booking_id=p_booking_id and status='funds_held' returning * into v_settlement;
  elsif p_action = 'decline' then
    if p_actor_user_id is distinct from v_booking.provider_user_id then raise exception 'ONLY_PROVIDER_CAN_DECLINE'; end if;
    if v_booking.booking_status <> 'pending' then raise exception 'BOOKING_NOT_PENDING'; end if;
    v_next := 'declined';
    update public.buddy_bookings set booking_status='declined',cancelled_at=now(),provider_note=nullif(trim(p_note),''),updated_at=now() where id=p_booking_id returning * into v_booking;
    update public.buddy_service_slots set slot_status='open',updated_at=now() where id=v_booking.slot_id;
    if v_booking.payment_status='paid' then update public.buddy_settlements set status='refund_pending',hold_reason='provider_declined',updated_at=now() where booking_id=p_booking_id returning * into v_settlement; end if;
  elsif p_action = 'cancel' then
    if p_actor_user_id is distinct from v_booking.buyer_user_id and p_actor_user_id is distinct from v_booking.provider_user_id then raise exception 'BOOKING_PARTY_REQUIRED'; end if;
    if v_booking.booking_status not in ('pending','accepted') then raise exception 'BOOKING_CANNOT_CANCEL'; end if;
    if v_booking.booking_status='accepted' and now() >= v_booking.scheduled_start_at then raise exception 'BUDDY_CANCELLATION_REQUIRES_DISPUTE'; end if;
    v_next := 'cancelled';
    update public.buddy_bookings set booking_status='cancelled',cancelled_at=now(),updated_at=now() where id=p_booking_id returning * into v_booking;
    update public.buddy_service_slots set slot_status='open',updated_at=now() where id=v_booking.slot_id;
    if v_booking.payment_status='paid' then update public.buddy_settlements set status='refund_pending',hold_reason='booking_cancelled',updated_at=now() where booking_id=p_booking_id returning * into v_settlement; end if;
  else
    raise exception 'INVALID_BOOKING_ACTION';
  end if;
  insert into public.buddy_booking_events(booking_id,actor_user_id,event_type,metadata)
  values(p_booking_id,p_actor_user_id,'commercial_booking_'||p_action,jsonb_build_object('from_status',v_from,'to_status',v_next,'note',p_note));
  if v_settlement.id is not null then
    insert into public.buddy_settlement_events(settlement_id,booking_id,actor_user_id,actor_role,event_type,from_status,to_status,metadata)
    values(v_settlement.id,p_booking_id,p_actor_user_id,case when p_actor_user_id=v_booking.provider_user_id then 'provider' else 'buyer' end,'booking_'||p_action,null,v_settlement.status,jsonb_build_object('note',p_note));
  end if;
  return jsonb_build_object('booking',to_jsonb(v_booking),'settlement',to_jsonb(v_settlement));
end;
$$;

create or replace function public.cowork_confirm_buddy_completion_v3(
  p_booking_id uuid,
  p_user_id uuid,
  p_hold_hours integer
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.buddy_bookings%rowtype;
  v_settlement public.buddy_settlements%rowtype;
  v_role text;
  v_both boolean;
  v_dispute boolean;
begin
  select * into v_booking from public.buddy_bookings where id=p_booking_id for update;
  if not found then raise exception 'BUDDY_BOOKING_NOT_FOUND'; end if;
  if v_booking.booking_status not in ('accepted','completed') or v_booking.payment_status <> 'paid' then raise exception 'BOOKING_NOT_COMPLETABLE'; end if;
  if now() < v_booking.scheduled_end_at - interval '15 minutes' then raise exception 'BUDDY_COMPLETION_TOO_EARLY'; end if;
  if p_user_id=v_booking.buyer_user_id then
    v_role := 'buyer';
    update public.buddy_bookings set buyer_completed_at=coalesce(buyer_completed_at,now()),updated_at=now() where id=p_booking_id returning * into v_booking;
  elsif p_user_id=v_booking.provider_user_id then
    v_role := 'provider';
    update public.buddy_bookings set provider_completed_at=coalesce(provider_completed_at,now()),updated_at=now() where id=p_booking_id returning * into v_booking;
  else raise exception 'BOOKING_PARTY_REQUIRED'; end if;
  v_both := v_booking.buyer_completed_at is not null and v_booking.provider_completed_at is not null;
  select exists(select 1 from public.buddy_disputes d where d.booking_id=p_booking_id and d.dispute_status in ('open','reviewing')) into v_dispute;
  select * into v_settlement from public.buddy_settlements where booking_id=p_booking_id for update;
  if not found then raise exception 'BUDDY_SETTLEMENT_NOT_FOUND'; end if;
  if v_both then
    update public.buddy_bookings set booking_status='completed',completed_at=coalesce(completed_at,now()),updated_at=now() where id=p_booking_id returning * into v_booking;
    if v_dispute then
      update public.buddy_settlements set status='dispute_hold',available_for_payout_at=null,hold_reason='open_dispute',updated_at=now() where id=v_settlement.id returning * into v_settlement;
    else
      update public.buddy_settlements set status='completed_hold',available_for_payout_at=now() + make_interval(hours=>greatest(0,least(p_hold_hours,720))),hold_reason=null,updated_at=now() where id=v_settlement.id returning * into v_settlement;
    end if;
  end if;
  insert into public.buddy_settlement_events(settlement_id,booking_id,actor_user_id,actor_role,event_type,from_status,to_status,metadata)
  values(v_settlement.id,p_booking_id,p_user_id,v_role,'completion_confirmed',v_settlement.status,v_settlement.status,jsonb_build_object('both_confirmed',v_both,'available_for_payout_at',v_settlement.available_for_payout_at));
  return jsonb_build_object('booking',to_jsonb(v_booking),'settlement',to_jsonb(v_settlement),'both_confirmed',v_both);
end;
$$;

create or replace function public.cowork_hold_buddy_settlement_v3(
  p_booking_id uuid,
  p_actor_user_id uuid,
  p_reason text,
  p_dispute_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_row public.buddy_settlements%rowtype; v_booking public.buddy_bookings%rowtype; v_from text; v_actor_role text;
begin
  select * into v_booking from public.buddy_bookings where id=p_booking_id;
  select * into v_row from public.buddy_settlements where booking_id=p_booking_id for update;
  if not found then raise exception 'BUDDY_SETTLEMENT_NOT_FOUND'; end if;
  if v_row.status in ('refunded','paid_out') then raise exception 'SETTLEMENT_TERMINAL'; end if;
  v_from := v_row.status;
  v_actor_role := case
    when p_actor_user_id is null then 'system'
    when p_actor_user_id = v_booking.buyer_user_id then 'buyer'
    when p_actor_user_id = v_booking.provider_user_id then 'provider'
    else 'admin'
  end;
  update public.buddy_settlements set status='dispute_hold',available_for_payout_at=null,hold_reason=left(coalesce(p_reason,'manual_hold'),500),metadata=metadata||jsonb_build_object('dispute_id',p_dispute_id),updated_at=now() where id=v_row.id returning * into v_row;
  insert into public.buddy_settlement_events(settlement_id,booking_id,actor_user_id,actor_role,event_type,from_status,to_status,metadata)
  values(v_row.id,p_booking_id,p_actor_user_id,v_actor_role,'settlement_held',v_from,'dispute_hold',jsonb_build_object('reason',p_reason,'dispute_id',p_dispute_id));
  return to_jsonb(v_row);
end;
$$;

create or replace function public.cowork_release_buddy_settlement_v3(
  p_booking_id uuid,
  p_admin_user_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_row public.buddy_settlements%rowtype; v_booking public.buddy_bookings%rowtype; v_from text;
begin
  select * into v_booking from public.buddy_bookings where id=p_booking_id for update;
  if not found then raise exception 'BUDDY_BOOKING_NOT_FOUND'; end if;
  select * into v_row from public.buddy_settlements where booking_id=p_booking_id for update;
  if not found then raise exception 'BUDDY_SETTLEMENT_NOT_FOUND'; end if;
  if v_booking.booking_status <> 'completed' then raise exception 'BOOKING_NOT_COMPLETED'; end if;
  if exists(select 1 from public.buddy_disputes d where d.booking_id=p_booking_id and d.dispute_status in ('open','reviewing')) then raise exception 'OPEN_DISPUTE_EXISTS'; end if;
  if v_row.status in ('refunded','paid_out','payout_processing') then raise exception 'SETTLEMENT_NOT_RELEASABLE'; end if;
  v_from := v_row.status;
  update public.buddy_settlements set status='releasable',available_for_payout_at=now(),hold_reason=null,metadata=metadata||jsonb_build_object('release_reason',p_reason,'released_by',p_admin_user_id),updated_at=now() where id=v_row.id returning * into v_row;
  insert into public.buddy_settlement_events(settlement_id,booking_id,actor_user_id,actor_role,event_type,from_status,to_status,metadata)
  values(v_row.id,p_booking_id,p_admin_user_id,'admin','settlement_released',v_from,'releasable',jsonb_build_object('reason',p_reason));
  return to_jsonb(v_row);
end;
$$;


create or replace function public.cowork_claim_buddy_room_provision_v3(
  p_booking_id uuid,
  p_user_id uuid,
  p_early_minutes integer default 15,
  p_late_minutes integer default 15
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_booking public.buddy_bookings%rowtype; v_claimed boolean:=false;
begin
  select * into v_booking from public.buddy_bookings where id=p_booking_id for update;
  if not found then raise exception 'BUDDY_BOOKING_NOT_FOUND'; end if;
  if p_user_id is distinct from v_booking.buyer_user_id and p_user_id is distinct from v_booking.provider_user_id then raise exception 'BOOKING_PARTY_REQUIRED'; end if;
  if v_booking.booking_status <> 'accepted' or v_booking.payment_status <> 'paid' then raise exception 'BOOKING_NOT_READY_FOR_ROOM'; end if;
  if now() < v_booking.scheduled_start_at - make_interval(mins=>greatest(0,least(p_early_minutes,60))) then raise exception 'BUDDY_ROOM_TOO_EARLY'; end if;
  if now() > v_booking.scheduled_end_at + make_interval(mins=>greatest(0,least(p_late_minutes,60))) then raise exception 'BUDDY_ROOM_WINDOW_ENDED'; end if;
  if v_booking.linked_room_id is not null and v_booking.room_provision_status='ready' then
    return jsonb_build_object('claimed',false,'ready',true,'booking',to_jsonb(v_booking));
  end if;
  if v_booking.room_provision_status='provisioning' and v_booking.room_provision_claimed_at > now()-interval '2 minutes' then
    return jsonb_build_object('claimed',false,'ready',false,'in_progress',true,'booking',to_jsonb(v_booking));
  end if;
  update public.buddy_bookings set room_provision_status='provisioning',room_provision_claimed_at=now(),room_provision_error=null,updated_at=now() where id=p_booking_id returning * into v_booking;
  v_claimed:=true;
  insert into public.buddy_booking_events(booking_id,actor_user_id,event_type,metadata)
  values(p_booking_id,p_user_id,'fulfillment_room_provision_claimed',jsonb_build_object('claimed_at',v_booking.room_provision_claimed_at));
  return jsonb_build_object('claimed',v_claimed,'ready',false,'booking',to_jsonb(v_booking));
end;
$$;

create or replace function public.cowork_finish_buddy_room_provision_v3(
  p_booking_id uuid,
  p_actor_user_id uuid,
  p_room_id uuid,
  p_invite_code text,
  p_error text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_booking public.buddy_bookings%rowtype;
begin
  select * into v_booking from public.buddy_bookings where id=p_booking_id for update;
  if not found then raise exception 'BUDDY_BOOKING_NOT_FOUND'; end if;
  if p_actor_user_id is distinct from v_booking.buyer_user_id and p_actor_user_id is distinct from v_booking.provider_user_id then raise exception 'BOOKING_PARTY_REQUIRED'; end if;
  if p_room_id is not null then
    update public.buddy_bookings set linked_room_id=p_room_id,linked_room_invite_code=p_invite_code,room_provision_status='ready',room_provision_error=null,updated_at=now() where id=p_booking_id returning * into v_booking;
    insert into public.buddy_booking_events(booking_id,actor_user_id,event_type,metadata)
    values(p_booking_id,p_actor_user_id,'fulfillment_room_ready',jsonb_build_object('room_id',p_room_id));
  else
    update public.buddy_bookings set room_provision_status='failed',room_provision_error=left(coalesce(p_error,'room_provision_failed'),1000),updated_at=now() where id=p_booking_id returning * into v_booking;
    insert into public.buddy_booking_events(booking_id,actor_user_id,event_type,metadata)
    values(p_booking_id,p_actor_user_id,'fulfillment_room_failed',jsonb_build_object('error',p_error));
  end if;
  return to_jsonb(v_booking);
end;
$$;

create or replace function public.cowork_reverse_buddy_payment_v3(
  p_payment_order_id uuid,
  p_refund_request_id uuid,
  p_refund_amount_twd integer
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_row public.buddy_settlements%rowtype; v_app public.buddy_booking_payment_applications%rowtype; v_status text;
begin
  select * into v_row from public.buddy_settlements where payment_order_id=p_payment_order_id for update;
  if not found then return jsonb_build_object('skipped',true,'reason','not_buddy_payment'); end if;
  if v_row.status='refunded' then return jsonb_build_object('skipped',true,'reason','already_refunded','settlement',to_jsonb(v_row)); end if;
  if p_refund_amount_twd < v_row.gross_amount_twd then
    update public.buddy_settlements set status='manual_review',refund_amount_twd=p_refund_amount_twd,hold_reason='partial_refund_requires_manual_allocation',updated_at=now() where id=v_row.id returning * into v_row;
    insert into public.reliability_events(user_id,event_type,severity,source,metadata)
    values(v_row.provider_user_id,'manual_note','high','buddy_settlement',jsonb_build_object('signal','p3_partial_buddy_refund_requires_manual_review','settlement_id',v_row.id,'refund_request_id',p_refund_request_id,'amount_twd',p_refund_amount_twd));
    return jsonb_build_object('manual_review',true,'settlement',to_jsonb(v_row));
  end if;
  v_status := v_row.status;
  if v_row.status='paid_out' then
    update public.buddy_settlements set status='manual_review',refund_amount_twd=p_refund_amount_twd,hold_reason='refund_after_payout_requires_clawback',updated_at=now() where id=v_row.id returning * into v_row;
    insert into public.reliability_events(user_id,event_type,severity,source,metadata)
    values(v_row.provider_user_id,'manual_note','critical','buddy_settlement',jsonb_build_object('signal','p3_buddy_refund_after_payout','settlement_id',v_row.id,'refund_request_id',p_refund_request_id));
    return jsonb_build_object('manual_review',true,'reason','refund_after_payout','settlement',to_jsonb(v_row));
  end if;
  update public.buddy_settlements set status='refunded',refund_amount_twd=p_refund_amount_twd,available_for_payout_at=null,hold_reason=null,metadata=metadata||jsonb_build_object('refund_request_id',p_refund_request_id),updated_at=now() where id=v_row.id returning * into v_row;
  update public.buddy_booking_payment_applications set status='reversed',reversed_at=now(),updated_at=now() where payment_order_id=p_payment_order_id returning * into v_app;
  update public.buddy_bookings set payment_status='refunded',updated_at=now() where id=v_row.booking_id;
  insert into public.buddy_settlement_events(settlement_id,booking_id,actor_role,event_type,from_status,to_status,amount_twd,metadata)
  values(v_row.id,v_row.booking_id,'system','payment_refunded',v_status,'refunded',p_refund_amount_twd,jsonb_build_object('refund_request_id',p_refund_request_id));
  insert into public.billing_ledger(user_id,provider,ledger_type,direction,amount_twd,currency,payment_order_id,buddy_booking_id,description,metadata)
  values(v_row.buyer_user_id,'ecpay','buddy_refund','debit',p_refund_amount_twd,'TWD',p_payment_order_id,v_row.booking_id,'Buddies 預約退款',jsonb_build_object('refund_request_id',p_refund_request_id)) on conflict do nothing;
  insert into public.billing_ledger(user_id,provider,ledger_type,direction,amount_twd,currency,payment_order_id,buddy_booking_id,description,metadata)
  values(v_row.provider_user_id,'internal','buddy_provider_payable_reversal','none',v_row.provider_net_twd,'TWD',p_payment_order_id,v_row.booking_id,'Buddies 提供者應付帳款反轉',jsonb_build_object('refund_request_id',p_refund_request_id)) on conflict do nothing;
  return jsonb_build_object('reversed',true,'settlement',to_jsonb(v_row),'application',to_jsonb(v_app));
end;
$$;

create or replace function public.cowork_p3_refund_reversal_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status='refunded' and old.status is distinct from new.status and new.payment_order_id is not null then
    begin
      perform public.cowork_reverse_buddy_payment_v3(new.payment_order_id,new.id,coalesce(new.amount_twd,0));
    exception when others then
      insert into public.reliability_events(user_id,event_type,severity,source,metadata)
      values(new.user_id,'manual_note','critical','refund_trigger',jsonb_build_object('signal','p3_buddy_refund_reversal_failed','refund_request_id',new.id,'payment_order_id',new.payment_order_id,'error',sqlerrm));
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_p3_buddy_refund_reversal on public.refund_requests;
create trigger trg_p3_buddy_refund_reversal
after update of status on public.refund_requests
for each row execute function public.cowork_p3_refund_reversal_trigger();

create or replace function public.cowork_expire_unpaid_buddy_bookings_v3(p_limit integer default 200)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_row public.buddy_bookings%rowtype; v_count integer:=0;
begin
  for v_row in
    select * from public.buddy_bookings
    where booking_status='pending' and payment_status='unpaid' and payment_due_at is not null and payment_due_at < now()
    order by payment_due_at for update skip locked limit greatest(1,least(p_limit,500))
  loop
    update public.buddy_bookings set booking_status='cancelled',cancelled_at=now(),updated_at=now() where id=v_row.id;
    update public.buddy_service_slots set slot_status='open',updated_at=now() where id=v_row.slot_id and slot_status='held';
    insert into public.buddy_booking_events(booking_id,event_type,metadata) values(v_row.id,'payment_window_expired',jsonb_build_object('payment_due_at',v_row.payment_due_at));
    v_count:=v_count+1;
  end loop;
  return jsonb_build_object('expired_count',v_count);
end;
$$;

create or replace function public.cowork_promote_buddy_settlements_v3(p_limit integer default 200)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_row public.buddy_settlements%rowtype; v_count integer:=0;
begin
  for v_row in
    select * from public.buddy_settlements s
    where s.status='completed_hold' and s.available_for_payout_at <= now()
      and not exists(select 1 from public.buddy_disputes d where d.booking_id=s.booking_id and d.dispute_status in ('open','reviewing'))
    order by s.available_for_payout_at for update skip locked limit greatest(1,least(p_limit,500))
  loop
    update public.buddy_settlements set status='releasable',updated_at=now() where id=v_row.id;
    insert into public.buddy_settlement_events(settlement_id,booking_id,actor_role,event_type,from_status,to_status)
    values(v_row.id,v_row.booking_id,'system','hold_period_completed','completed_hold','releasable');
    v_count:=v_count+1;
  end loop;
  return jsonb_build_object('promoted_count',v_count);
end;
$$;


create or replace function public.cowork_resolve_buddy_dispute_v3(
  p_dispute_id uuid,
  p_admin_user_id uuid,
  p_action text,
  p_settlement_resolution text,
  p_admin_note text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dispute public.buddy_disputes%rowtype;
  v_booking public.buddy_bookings%rowtype;
  v_settlement public.buddy_settlements%rowtype;
  v_refund public.refund_requests%rowtype;
  v_next_dispute text;
  v_next_settlement text;
  v_from_settlement text;
begin
  select * into v_dispute from public.buddy_disputes where id=p_dispute_id for update;
  if not found then raise exception 'BUDDY_DISPUTE_NOT_FOUND'; end if;
  select * into v_booking from public.buddy_bookings where id=v_dispute.booking_id for update;
  if not found then raise exception 'BUDDY_BOOKING_NOT_FOUND'; end if;
  select * into v_settlement from public.buddy_settlements where booking_id=v_booking.id for update;
  if not found then raise exception 'BUDDY_SETTLEMENT_NOT_FOUND'; end if;
  v_from_settlement:=v_settlement.status;

  if p_action='review' then
    v_next_dispute:='reviewing';
    v_next_settlement:='dispute_hold';
  elsif p_action in ('resolve','reject','cancel') then
    v_next_dispute:=case when p_action='resolve' then 'resolved' when p_action='reject' then 'rejected' else 'cancelled' end;
    if p_settlement_resolution='refund' then
      v_next_settlement:='refund_pending';
      select * into v_refund from public.refund_requests
      where payment_order_id=v_booking.payment_order_id and status in ('requested','reviewing','approved','processing','refunded')
      order by created_at desc limit 1;
      if not found then
        insert into public.refund_requests(user_id,payment_order_id,amount_twd,reason_category,reason,status,provider,metadata)
        values(v_booking.buyer_user_id,v_booking.payment_order_id,v_booking.total_amount_twd,'service_issue',coalesce(nullif(trim(p_admin_note),''),'Buddies 爭議全額退款'),'requested','ecpay',jsonb_build_object('buddy_booking_id',v_booking.id,'buddy_dispute_id',v_dispute.id,'admin_user_id',p_admin_user_id))
        returning * into v_refund;
      end if;
    elsif p_settlement_resolution='release' then
      if v_booking.booking_status <> 'completed' then raise exception 'BOOKING_NOT_COMPLETED_FOR_RELEASE'; end if;
      v_next_settlement:='releasable';
    else
      v_next_settlement:='manual_review';
    end if;
  else raise exception 'INVALID_DISPUTE_ACTION'; end if;

  update public.buddy_disputes set dispute_status=v_next_dispute,admin_user_id=p_admin_user_id,
    admin_note=nullif(trim(p_admin_note),''),resolved_at=case when v_next_dispute in ('resolved','rejected','cancelled') then now() else null end,
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('settlement_resolution',coalesce(p_settlement_resolution,'manual_review')),
    updated_at=now() where id=v_dispute.id returning * into v_dispute;
  update public.buddy_bookings set dispute_status=v_next_dispute,updated_at=now() where id=v_booking.id returning * into v_booking;
  update public.buddy_settlements set status=v_next_settlement,
    available_for_payout_at=case when v_next_settlement='releasable' then now() else null end,
    hold_reason=case when v_next_settlement in ('dispute_hold','manual_review','refund_pending') then coalesce(nullif(trim(p_admin_note),''),v_next_settlement) else null end,
    updated_at=now() where id=v_settlement.id returning * into v_settlement;
  insert into public.buddy_booking_events(booking_id,actor_user_id,event_type,metadata)
  values(v_booking.id,p_admin_user_id,'admin_dispute_'||v_next_dispute,jsonb_build_object('dispute_id',v_dispute.id,'settlement_resolution',p_settlement_resolution,'refund_request_id',v_refund.id));
  insert into public.buddy_settlement_events(settlement_id,booking_id,actor_user_id,actor_role,event_type,from_status,to_status,metadata)
  values(v_settlement.id,v_booking.id,p_admin_user_id,'admin','dispute_resolved',v_from_settlement,v_next_settlement,jsonb_build_object('dispute_id',v_dispute.id,'dispute_status',v_next_dispute,'refund_request_id',v_refund.id,'admin_note',p_admin_note));
  return jsonb_build_object('dispute',to_jsonb(v_dispute),'booking',to_jsonb(v_booking),'settlement',to_jsonb(v_settlement),'refund_request',to_jsonb(v_refund));
end;
$$;

create or replace function public.cowork_create_buddy_payout_batch_v3(
  p_admin_user_id uuid,
  p_provider_user_id uuid,
  p_settlement_ids uuid[],
  p_note text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_account public.buddy_payout_accounts%rowtype; v_batch public.buddy_payout_batches%rowtype; v_count integer; v_total integer; v_id uuid;
begin
  if p_settlement_ids is null or cardinality(p_settlement_ids)=0 then raise exception 'NO_SETTLEMENTS_SELECTED'; end if;
  select * into v_account from public.buddy_payout_accounts where provider_user_id=p_provider_user_id and status='verified' for update;
  if not found or v_account.secure_provider_reference is null then raise exception 'VERIFIED_PAYOUT_ACCOUNT_REQUIRED'; end if;
  select count(*),coalesce(sum(provider_net_twd),0) into v_count,v_total from public.buddy_settlements
  where id=any(p_settlement_ids) and provider_user_id=p_provider_user_id and status='releasable';
  if v_count <> cardinality(p_settlement_ids) then raise exception 'SETTLEMENT_SELECTION_NOT_RELEASABLE'; end if;
  insert into public.buddy_payout_batches(provider_user_id,payout_account_id,status,total_items,total_amount_twd,created_by_admin_user_id,note,metadata)
  values(p_provider_user_id,v_account.id,'approved',v_count,v_total,p_admin_user_id,nullif(trim(p_note),''),jsonb_build_object('payout_mode','manual_verified','raw_bank_account_stored',false)) returning * into v_batch;
  foreach v_id in array p_settlement_ids loop
    insert into public.buddy_payout_items(batch_id,settlement_id,provider_user_id,payout_account_id,amount_twd,status)
    select v_batch.id,s.id,s.provider_user_id,v_account.id,s.provider_net_twd,'queued' from public.buddy_settlements s where s.id=v_id;
    update public.buddy_settlements set status='payout_processing',payout_account_id=v_account.id,payout_batch_id=v_batch.id,updated_at=now() where id=v_id;
    insert into public.buddy_settlement_events(settlement_id,booking_id,actor_user_id,actor_role,event_type,from_status,to_status,metadata)
    select s.id,s.booking_id,p_admin_user_id,'admin','payout_batch_created','releasable','payout_processing',jsonb_build_object('batch_id',v_batch.id) from public.buddy_settlements s where s.id=v_id;
  end loop;
  return jsonb_build_object('batch',to_jsonb(v_batch));
end;
$$;

create or replace function public.cowork_transition_buddy_payout_batch_v3(
  p_batch_id uuid,
  p_admin_user_id uuid,
  p_action text,
  p_provider_reference text,
  p_note text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_batch public.buddy_payout_batches%rowtype; v_status text;
begin
  select * into v_batch from public.buddy_payout_batches where id=p_batch_id for update;
  if not found then raise exception 'PAYOUT_BATCH_NOT_FOUND'; end if;
  if p_action='mark_processing' then
    if v_batch.status <> 'approved' then raise exception 'PAYOUT_BATCH_NOT_APPROVED'; end if;
    v_status:='processing';
    update public.buddy_payout_batches set status='processing',processing_at=now(),processed_by_admin_user_id=p_admin_user_id,note=coalesce(nullif(trim(p_note),''),note),updated_at=now() where id=p_batch_id returning * into v_batch;
    update public.buddy_payout_items set status='processing',updated_at=now() where batch_id=p_batch_id and status='queued';
  elsif p_action='complete' then
    if v_batch.status not in ('approved','processing') then raise exception 'PAYOUT_BATCH_NOT_PROCESSABLE'; end if;
    if p_provider_reference is null or char_length(trim(p_provider_reference))<3 then raise exception 'PROVIDER_REFERENCE_REQUIRED'; end if;
    v_status:='completed';
    update public.buddy_payout_batches set status='completed',provider_reference=left(trim(p_provider_reference),180),completed_at=now(),processed_by_admin_user_id=p_admin_user_id,note=coalesce(nullif(trim(p_note),''),note),updated_at=now() where id=p_batch_id returning * into v_batch;
    update public.buddy_payout_items set status='paid',provider_reference=v_batch.provider_reference,processed_at=now(),updated_at=now() where batch_id=p_batch_id;
    update public.buddy_settlements set status='paid_out',paid_out_at=now(),updated_at=now() where payout_batch_id=p_batch_id;
    insert into public.billing_ledger(user_id,provider,ledger_type,direction,amount_twd,currency,payment_order_id,buddy_booking_id,description,metadata)
    select s.provider_user_id,'manual_bank_transfer','buddy_payout','debit',s.provider_net_twd,'TWD',s.payment_order_id,s.booking_id,'Buddies 人工撥款',jsonb_build_object('batch_id',p_batch_id,'provider_reference',v_batch.provider_reference)
    from public.buddy_settlements s where s.payout_batch_id=p_batch_id on conflict do nothing;
    insert into public.buddy_settlement_events(settlement_id,booking_id,actor_user_id,actor_role,event_type,from_status,to_status,metadata)
    select s.id,s.booking_id,p_admin_user_id,'admin','payout_completed','payout_processing','paid_out',jsonb_build_object('batch_id',p_batch_id,'provider_reference',v_batch.provider_reference)
    from public.buddy_settlements s where s.payout_batch_id=p_batch_id;
  elsif p_action in ('cancel','fail') then
    if v_batch.status='completed' then raise exception 'COMPLETED_BATCH_TERMINAL'; end if;
    v_status:=case when p_action='cancel' then 'cancelled' else 'failed' end;
    update public.buddy_payout_batches set status=v_status,error=case when p_action='fail' then coalesce(nullif(trim(p_note),''),'manual_payout_failed') else error end,processed_by_admin_user_id=p_admin_user_id,updated_at=now() where id=p_batch_id returning * into v_batch;
    update public.buddy_payout_items set status=case when p_action='cancel' then 'cancelled' else 'failed' end,error=case when p_action='fail' then p_note else null end,updated_at=now() where batch_id=p_batch_id;
    update public.buddy_settlements set status=case when p_action='cancel' then 'releasable' else 'manual_review' end,payout_batch_id=null,hold_reason=case when p_action='fail' then 'manual_payout_failed' else null end,updated_at=now() where payout_batch_id=p_batch_id;
  else raise exception 'INVALID_PAYOUT_BATCH_ACTION'; end if;
  return jsonb_build_object('batch',to_jsonb(v_batch),'status',v_status);
end;
$$;
commit;

-- ---------------------------------------------------------------------------
-- Stage 7: Function privileges and documentation comments.
-- ---------------------------------------------------------------------------
begin;
revoke all on function public.calmco_p3_touch_updated_at() from public, anon, authenticated;
revoke all on function public.cowork_create_buddy_booking_v3(uuid,uuid,uuid,text,integer) from public, anon, authenticated;
revoke all on function public.cowork_apply_buddy_payment_v3(uuid,uuid,uuid,integer,timestamptz,jsonb) from public, anon, authenticated;
revoke all on function public.cowork_transition_buddy_booking_v3(uuid,uuid,text,text,uuid,text) from public, anon, authenticated;
revoke all on function public.cowork_confirm_buddy_completion_v3(uuid,uuid,integer) from public, anon, authenticated;
revoke all on function public.cowork_hold_buddy_settlement_v3(uuid,uuid,text,uuid) from public, anon, authenticated;
revoke all on function public.cowork_release_buddy_settlement_v3(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.cowork_claim_buddy_room_provision_v3(uuid,uuid,integer,integer) from public, anon, authenticated;
revoke all on function public.cowork_finish_buddy_room_provision_v3(uuid,uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.cowork_reverse_buddy_payment_v3(uuid,uuid,integer) from public, anon, authenticated;
revoke all on function public.cowork_expire_unpaid_buddy_bookings_v3(integer) from public, anon, authenticated;
revoke all on function public.cowork_promote_buddy_settlements_v3(integer) from public, anon, authenticated;
revoke all on function public.cowork_resolve_buddy_dispute_v3(uuid,uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.cowork_create_buddy_payout_batch_v3(uuid,uuid,uuid[],text) from public, anon, authenticated;
revoke all on function public.cowork_transition_buddy_payout_batch_v3(uuid,uuid,text,text,text) from public, anon, authenticated;

grant execute on function public.cowork_create_buddy_booking_v3(uuid,uuid,uuid,text,integer) to service_role;
grant execute on function public.cowork_apply_buddy_payment_v3(uuid,uuid,uuid,integer,timestamptz,jsonb) to service_role;
grant execute on function public.cowork_transition_buddy_booking_v3(uuid,uuid,text,text,uuid,text) to service_role;
grant execute on function public.cowork_confirm_buddy_completion_v3(uuid,uuid,integer) to service_role;
grant execute on function public.cowork_hold_buddy_settlement_v3(uuid,uuid,text,uuid) to service_role;
grant execute on function public.cowork_release_buddy_settlement_v3(uuid,uuid,text) to service_role;
grant execute on function public.cowork_claim_buddy_room_provision_v3(uuid,uuid,integer,integer) to service_role;
grant execute on function public.cowork_finish_buddy_room_provision_v3(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.cowork_reverse_buddy_payment_v3(uuid,uuid,integer) to service_role;
grant execute on function public.cowork_expire_unpaid_buddy_bookings_v3(integer) to service_role;
grant execute on function public.cowork_promote_buddy_settlements_v3(integer) to service_role;
grant execute on function public.cowork_resolve_buddy_dispute_v3(uuid,uuid,text,text,text) to service_role;
grant execute on function public.cowork_create_buddy_payout_batch_v3(uuid,uuid,uuid[],text) to service_role;
grant execute on function public.cowork_transition_buddy_payout_batch_v3(uuid,uuid,text,text,text) to service_role;

comment on table public.buddy_settlements is 'Internal Buddies payable/hold ledger. Not legal escrow or trust custody.';
comment on column public.buddy_payout_accounts.secure_provider_reference is 'Reference to external secure record only. Never store raw bank account numbers here.';
commit;

reset lock_timeout;
reset statement_timeout;
reset idle_in_transaction_session_timeout;
