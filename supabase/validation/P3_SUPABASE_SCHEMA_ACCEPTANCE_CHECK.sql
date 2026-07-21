-- P3 Supabase schema acceptance. Safe, read-only and implemented as one CTE query.
-- Expected final row: P3_SUPABASE_SCHEMA_ACCEPTANCE = PASS, failed_checks = 0.

with checks(check_group, check_name, expected, actual, passed) as (
  select 'table', v.name, 'exists', coalesce(to_regclass('public.'||v.name)::text,'missing'), to_regclass('public.'||v.name) is not null
  from (values
    ('buddy_booking_payment_applications'),('buddy_settlements'),('buddy_settlement_events'),
    ('buddy_payout_accounts'),('buddy_payout_batches'),('buddy_payout_items')
  ) v(name)
  union all
  select 'rls', v.name, 'true', coalesce(c.relrowsecurity::text,'missing'), coalesce(c.relrowsecurity,false)
  from (values
    ('buddy_booking_payment_applications'),('buddy_settlements'),('buddy_settlement_events'),
    ('buddy_payout_accounts'),('buddy_payout_batches'),('buddy_payout_items')
  ) v(name)
  left join pg_namespace n on n.nspname='public'
  left join pg_class c on c.relnamespace=n.oid and c.relname=v.name and c.relkind='r'
  union all
  select 'browser_policy', v.name, '0', count(p.policyname)::text, count(p.policyname)=0
  from (values
    ('buddy_booking_payment_applications'),('buddy_settlements'),('buddy_settlement_events'),
    ('buddy_payout_accounts'),('buddy_payout_batches'),('buddy_payout_items')
  ) v(name)
  left join pg_policies p on p.schemaname='public' and p.tablename=v.name
  group by v.name
  union all
  select 'column','payment_orders.buddy_booking_id','exists',case when count(*)=1 then 'exists' else 'missing' end,count(*)=1
  from information_schema.columns where table_schema='public' and table_name='payment_orders' and column_name='buddy_booking_id'
  union all
  select 'column','buddy_bookings.p3_columns','8',count(*)::text,count(*)=8
  from information_schema.columns where table_schema='public' and table_name='buddy_bookings' and column_name in ('payment_order_id','settlement_id','payment_due_at','paid_at','payment_failed_at','room_provision_status','room_provision_claimed_at','room_provision_error')
  union all
  select 'rpc',v.signature,'exists',coalesce(to_regprocedure('public.'||v.signature)::text,'missing'),to_regprocedure('public.'||v.signature) is not null
  from (values
    ('cowork_create_buddy_booking_v3(uuid,uuid,uuid,text,integer)'),
    ('cowork_apply_buddy_payment_v3(uuid,uuid,uuid,integer,timestamp with time zone,jsonb)'),
    ('cowork_transition_buddy_booking_v3(uuid,uuid,text,text,uuid,text)'),
    ('cowork_confirm_buddy_completion_v3(uuid,uuid,integer)'),
    ('cowork_hold_buddy_settlement_v3(uuid,uuid,text,uuid)'),
    ('cowork_release_buddy_settlement_v3(uuid,uuid,text)'),
    ('cowork_claim_buddy_room_provision_v3(uuid,uuid,integer,integer)'),
    ('cowork_finish_buddy_room_provision_v3(uuid,uuid,uuid,text,text)'),
    ('cowork_reverse_buddy_payment_v3(uuid,uuid,integer)'),
    ('cowork_expire_unpaid_buddy_bookings_v3(integer)'),
    ('cowork_promote_buddy_settlements_v3(integer)'),
    ('cowork_resolve_buddy_dispute_v3(uuid,uuid,text,text,text)'),
    ('cowork_create_buddy_payout_batch_v3(uuid,uuid,uuid[],text)'),
    ('cowork_transition_buddy_payout_batch_v3(uuid,uuid,text,text,text)')
  ) v(signature)
  union all
  select 'security','anon direct table privileges','false',has_table_privilege('anon','public.buddy_settlements','select')::text,not has_table_privilege('anon','public.buddy_settlements','select')
  union all
  select 'security','authenticated direct table privileges','false',has_table_privilege('authenticated','public.buddy_payout_accounts','select')::text,not has_table_privilege('authenticated','public.buddy_payout_accounts','select')
  union all
  select 'security','service_role settlement select','true',has_table_privilege('service_role','public.buddy_settlements','select')::text,has_table_privilege('service_role','public.buddy_settlements','select')
  union all
  select 'security','anon execute payment rpc','false',has_function_privilege('anon','public.cowork_apply_buddy_payment_v3(uuid,uuid,uuid,integer,timestamp with time zone,jsonb)','execute')::text,not has_function_privilege('anon','public.cowork_apply_buddy_payment_v3(uuid,uuid,uuid,integer,timestamp with time zone,jsonb)','execute')
  union all
  select 'security','service_role execute payment rpc','true',has_function_privilege('service_role','public.cowork_apply_buddy_payment_v3(uuid,uuid,uuid,integer,timestamp with time zone,jsonb)','execute')::text,has_function_privilege('service_role','public.cowork_apply_buddy_payment_v3(uuid,uuid,uuid,integer,timestamp with time zone,jsonb)','execute')
  union all
  select 'safety','raw bank account column','0',count(*)::text,count(*)=0
  from information_schema.columns where table_schema='public' and table_name='buddy_payout_accounts' and column_name in ('account_number','bank_account_number','raw_account_number','full_account_number')
  union all
  select 'trigger','trg_p3_buddy_refund_reversal','exists',case when count(*)=1 then 'exists' else 'missing' end,count(*)=1
  from pg_trigger where tgname='trg_p3_buddy_refund_reversal' and not tgisinternal
)
select check_group,check_name,expected,actual,case when passed then 'PASS' else 'FAIL' end as result
from checks order by passed asc,check_group,check_name;

with checks(passed) as (
  select to_regclass('public.buddy_booking_payment_applications') is not null union all
  select to_regclass('public.buddy_settlements') is not null union all
  select to_regclass('public.buddy_settlement_events') is not null union all
  select to_regclass('public.buddy_payout_accounts') is not null union all
  select to_regclass('public.buddy_payout_batches') is not null union all
  select to_regclass('public.buddy_payout_items') is not null union all
  select to_regprocedure('public.cowork_apply_buddy_payment_v3(uuid,uuid,uuid,integer,timestamp with time zone,jsonb)') is not null union all
  select to_regprocedure('public.cowork_confirm_buddy_completion_v3(uuid,uuid,integer)') is not null union all
  select to_regprocedure('public.cowork_create_buddy_payout_batch_v3(uuid,uuid,uuid[],text)') is not null union all
  select not has_table_privilege('authenticated','public.buddy_payout_accounts','select') union all
  select has_function_privilege('service_role','public.cowork_apply_buddy_payment_v3(uuid,uuid,uuid,integer,timestamp with time zone,jsonb)','execute')
)
select case when bool_and(passed) then 'PASS' else 'FAIL' end as "P3_SUPABASE_SCHEMA_ACCEPTANCE",
       count(*) filter(where passed) as passed_checks,
       count(*) filter(where not passed) as failed_checks,
       count(*) as total_checks
from checks;
