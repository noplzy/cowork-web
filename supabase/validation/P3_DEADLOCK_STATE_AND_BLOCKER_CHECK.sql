-- P3 deadlock recovery: read-only state and blocker inspection.
-- Safe to run in Supabase SQL Editor as role postgres.
-- This script does not terminate sessions and does not change schema or data.

select
  current_database() as database_name,
  pg_backend_pid() as this_sql_editor_pid,
  now() as checked_at;

-- Map the relation OIDs shown in the 40P01 error, when they still exist.
-- Replace/add OIDs from the exact error if a later retry shows different numbers.
select
  c.oid as relation_oid,
  n.nspname as schema_name,
  c.relname as relation_name,
  c.relkind
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.oid in (17089, 91734)
order by c.oid;

-- Current non-idle sessions, their blockers and transaction age.
select
  a.pid,
  a.usename,
  a.application_name,
  a.client_addr,
  a.state,
  a.wait_event_type,
  a.wait_event,
  pg_blocking_pids(a.pid) as blocking_pids,
  now() - a.xact_start as transaction_age,
  left(regexp_replace(a.query, '\s+', ' ', 'g'), 300) as query_excerpt
from pg_stat_activity a
where a.datname = current_database()
  and a.pid <> pg_backend_pid()
  and (a.state <> 'idle' or cardinality(pg_blocking_pids(a.pid)) > 0)
order by a.xact_start nulls last, a.query_start;

-- Locks on the P3 hot tables.
select
  l.pid,
  n.nspname as schema_name,
  c.relname as relation_name,
  l.mode,
  l.granted,
  a.state,
  now() - a.xact_start as transaction_age,
  left(regexp_replace(a.query, '\s+', ' ', 'g'), 250) as query_excerpt
from pg_locks l
join pg_class c on c.oid = l.relation
join pg_namespace n on n.oid = c.relnamespace
left join pg_stat_activity a on a.pid = l.pid
where n.nspname = 'public'
  and c.relname in ('payment_orders','buddy_bookings','billing_ledger')
order by c.relname, l.granted, l.mode, l.pid;

-- P3 object state after the deadlock-aborted attempt.
with expected_tables(name) as (
  values
    ('buddy_booking_payment_applications'),
    ('buddy_settlements'),
    ('buddy_settlement_events'),
    ('buddy_payout_accounts'),
    ('buddy_payout_batches'),
    ('buddy_payout_items')
),
expected_columns(table_name, column_name) as (
  values
    ('payment_orders','buddy_booking_id'),
    ('buddy_bookings','payment_order_id'),
    ('buddy_bookings','settlement_id'),
    ('buddy_bookings','payment_due_at'),
    ('buddy_bookings','paid_at'),
    ('buddy_bookings','payment_failed_at'),
    ('buddy_bookings','room_provision_status'),
    ('buddy_bookings','room_provision_claimed_at'),
    ('buddy_bookings','room_provision_error'),
    ('billing_ledger','buddy_booking_id')
),
expected_functions(name) as (
  values
    ('cowork_create_buddy_booking_v3'),
    ('cowork_apply_buddy_payment_v3'),
    ('cowork_transition_buddy_booking_v3'),
    ('cowork_confirm_buddy_completion_v3'),
    ('cowork_hold_buddy_settlement_v3'),
    ('cowork_release_buddy_settlement_v3'),
    ('cowork_claim_buddy_room_provision_v3'),
    ('cowork_finish_buddy_room_provision_v3'),
    ('cowork_reverse_buddy_payment_v3'),
    ('cowork_expire_unpaid_buddy_bookings_v3'),
    ('cowork_promote_buddy_settlements_v3'),
    ('cowork_resolve_buddy_dispute_v3'),
    ('cowork_create_buddy_payout_batch_v3'),
    ('cowork_transition_buddy_payout_batch_v3')
)
select 'tables' as object_group,
       count(*) filter (where to_regclass('public.' || name) is not null) as present,
       count(*) as expected
from expected_tables
union all
select 'columns',
       count(*) filter (where exists (
         select 1 from information_schema.columns c
         where c.table_schema='public'
           and c.table_name=expected_columns.table_name
           and c.column_name=expected_columns.column_name
       )),
       count(*)
from expected_columns
union all
select 'functions',
       count(*) filter (where exists (
         select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
         where n.nspname='public' and p.proname=expected_functions.name
       )),
       count(*)
from expected_functions;

select case
  when exists (
    select 1 from pg_stat_activity a
    where a.datname=current_database()
      and a.pid<>pg_backend_pid()
      and cardinality(pg_blocking_pids(a.pid)) > 0
  ) then 'WAIT_FOR_BLOCKERS'
  else 'READY_TO_RUN_DEADLOCK_SAFE_MIGRATION'
end as p3_deadlock_recovery_status;
