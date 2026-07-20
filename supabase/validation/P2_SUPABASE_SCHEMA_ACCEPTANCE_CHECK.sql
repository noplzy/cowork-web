-- Calm&Co / 安感島 P2 Schema Acceptance
-- Safe: read-only. This version deliberately uses one CTE and no temporary
-- table, so it is safe even when Supabase SQL Editor changes sessions.
-- Expected final row:
--   check_group = FINAL
--   check_name = P2_SUPABASE_SCHEMA_ACCEPTANCE
--   actual/result = PASS
--   failed_checks = 0

with checks as (
  select 'migration'::text as check_group,
         '20260720123000 recorded'::text as check_name,
         'true'::text as expected,
         exists (
           select 1
           from supabase_migrations.schema_migrations
           where version = '20260720123000'
         )::text as actual,
         exists (
           select 1
           from supabase_migrations.schema_migrations
           where version = '20260720123000'
         ) as passed

  union all
  select 'table', item.name, 'exists',
         coalesce(to_regclass('public.' || item.name)::text, 'missing'),
         to_regclass('public.' || item.name) is not null
  from (values
    ('user_plan_entitlements'),
    ('user_usage_wallets'),
    ('user_usage_wallet_events'),
    ('subscription_payment_applications'),
    ('room_extension_grants'),
    ('payment_orders'),
    ('subscription_profiles'),
    ('subscription_events'),
    ('ecpay_subscription_tasks'),
    ('billing_ledger'),
    ('invoice_events'),
    ('entitlement_events'),
    ('user_entitlements'),
    ('refund_requests'),
    ('reliability_events'),
    ('room_access_sessions'),
    ('room_extension_confirmations')
  ) item(name)

  union all
  select 'rls', item.name, 'true',
         coalesce(c.relrowsecurity::text, 'missing'),
         coalesce(c.relrowsecurity, false)
  from (values
    ('user_plan_entitlements'),
    ('user_usage_wallets'),
    ('user_usage_wallet_events'),
    ('subscription_payment_applications'),
    ('room_extension_grants')
  ) item(name)
  left join pg_namespace n
    on n.nspname = 'public'
  left join pg_class c
    on c.relnamespace = n.oid
   and c.relname = item.name
   and c.relkind = 'r'

  union all
  select 'browser_privilege',
         item.role_name || ':' || item.table_name,
         'false',
         coalesce(
           has_table_privilege(
             item.role_name,
             to_regclass('public.' || item.table_name),
             'select,insert,update,delete'
           ),
           false
         )::text,
         not coalesce(
           has_table_privilege(
             item.role_name,
             to_regclass('public.' || item.table_name),
             'select,insert,update,delete'
           ),
           false
         )
  from (values
    ('anon','user_plan_entitlements'),
    ('anon','user_usage_wallets'),
    ('anon','user_usage_wallet_events'),
    ('anon','subscription_payment_applications'),
    ('anon','room_extension_grants'),
    ('authenticated','user_plan_entitlements'),
    ('authenticated','user_usage_wallets'),
    ('authenticated','user_usage_wallet_events'),
    ('authenticated','subscription_payment_applications'),
    ('authenticated','room_extension_grants'),
    ('anon','subscription_profiles'),
    ('authenticated','subscription_profiles'),
    ('anon','subscription_events'),
    ('authenticated','subscription_events'),
    ('anon','ecpay_subscription_tasks'),
    ('authenticated','ecpay_subscription_tasks')
  ) item(role_name, table_name)

  union all
  select 'service_role_privilege',
         item.table_name,
         'true',
         coalesce(
           has_table_privilege(
             'service_role',
             to_regclass('public.' || item.table_name),
             'select,insert,update,delete'
           ),
           false
         )::text,
         coalesce(
           has_table_privilege(
             'service_role',
             to_regclass('public.' || item.table_name),
             'select,insert,update,delete'
           ),
           false
         )
  from (values
    ('user_plan_entitlements'),
    ('user_usage_wallets'),
    ('user_usage_wallet_events'),
    ('subscription_payment_applications'),
    ('room_extension_grants'),
    ('subscription_profiles'),
    ('subscription_events'),
    ('ecpay_subscription_tasks')
  ) item(table_name)

  union all
  select 'rpc',
         item.signature,
         'exists',
         coalesce(to_regprocedure(item.signature)::text, 'missing'),
         to_regprocedure(item.signature) is not null
  from (values
    ('public.cowork_consume_usage_wallet_v2(uuid,text,bigint,text,uuid,uuid,uuid,boolean,jsonb)'),
    ('public.cowork_apply_subscription_payment_v2(uuid,uuid,uuid,text,timestamp with time zone,timestamp with time zone,text,jsonb)'),
    ('public.cowork_finalize_room_extension_v2(uuid,uuid,text,text,jsonb)'),
    ('public.cowork_reverse_subscription_payment_v2(uuid,uuid,integer,text,jsonb)'),
    ('public.cowork_p2_refund_reversal_trigger()')
  ) item(signature)

  union all
  select 'rpc_browser_execute',
         item.role_name || ':' || item.signature,
         'false',
         coalesce(
           has_function_privilege(
             item.role_name,
             to_regprocedure(item.signature),
             'execute'
           ),
           false
         )::text,
         not coalesce(
           has_function_privilege(
             item.role_name,
             to_regprocedure(item.signature),
             'execute'
           ),
           false
         )
  from (values
    ('anon','public.cowork_consume_usage_wallet_v2(uuid,text,bigint,text,uuid,uuid,uuid,boolean,jsonb)'),
    ('authenticated','public.cowork_consume_usage_wallet_v2(uuid,text,bigint,text,uuid,uuid,uuid,boolean,jsonb)'),
    ('anon','public.cowork_apply_subscription_payment_v2(uuid,uuid,uuid,text,timestamp with time zone,timestamp with time zone,text,jsonb)'),
    ('authenticated','public.cowork_apply_subscription_payment_v2(uuid,uuid,uuid,text,timestamp with time zone,timestamp with time zone,text,jsonb)'),
    ('anon','public.cowork_finalize_room_extension_v2(uuid,uuid,text,text,jsonb)'),
    ('authenticated','public.cowork_finalize_room_extension_v2(uuid,uuid,text,text,jsonb)'),
    ('anon','public.cowork_reverse_subscription_payment_v2(uuid,uuid,integer,text,jsonb)'),
    ('authenticated','public.cowork_reverse_subscription_payment_v2(uuid,uuid,integer,text,jsonb)'),
    ('anon','public.cowork_p2_refund_reversal_trigger()'),
    ('authenticated','public.cowork_p2_refund_reversal_trigger()')
  ) item(role_name, signature)

  union all
  select 'rpc_service_execute',
         item.signature,
         'true',
         coalesce(
           has_function_privilege(
             'service_role',
             to_regprocedure(item.signature),
             'execute'
           ),
           false
         )::text,
         coalesce(
           has_function_privilege(
             'service_role',
             to_regprocedure(item.signature),
             'execute'
           ),
           false
         )
  from (values
    ('public.cowork_consume_usage_wallet_v2(uuid,text,bigint,text,uuid,uuid,uuid,boolean,jsonb)'),
    ('public.cowork_apply_subscription_payment_v2(uuid,uuid,uuid,text,timestamp with time zone,timestamp with time zone,text,jsonb)'),
    ('public.cowork_finalize_room_extension_v2(uuid,uuid,text,text,jsonb)'),
    ('public.cowork_reverse_subscription_payment_v2(uuid,uuid,integer,text,jsonb)'),
    ('public.cowork_p2_refund_reversal_trigger()')
  ) item(signature)

  union all
  select 'trigger',
         'trg_p2_refund_reversal',
         'exists',
         case when t.oid is null then 'missing' else 'exists' end,
         t.oid is not null
  from (select 1) seed
  left join pg_namespace n
    on n.nspname = 'public'
  left join pg_class c
    on c.relnamespace = n.oid
   and c.relname = 'refund_requests'
  left join pg_trigger t
    on t.tgrelid = c.oid
   and t.tgname = 'trg_p2_refund_reversal'
   and not t.tgisinternal

  union all
  select 'column',
         item.table_name || '.' || item.column_name,
         'exists',
         case when c.column_name is null then 'missing' else 'exists' end,
         c.column_name is not null
  from (values
    ('subscription_profiles','commercial_entitlement_status'),
    ('subscription_profiles','entitlement_applied_at'),
    ('subscription_payment_applications','reversed_at'),
    ('subscription_payment_applications','reversal_refund_request_id'),
    ('room_access_sessions','commercial_plan_code'),
    ('room_access_sessions','wallet_visual_debited_seconds'),
    ('room_access_sessions','wallet_visual_overage_seconds'),
    ('room_extension_confirmations','extension_grant_id'),
    ('room_extension_confirmations','finalization_status'),
    ('room_extension_confirmations','finalized_at'),
    ('room_extension_confirmations','sponsor_user_id'),
    ('room_extension_confirmations','points_consumed'),
    ('room_extension_confirmations','new_scheduled_end_at')
  ) item(table_name, column_name)
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = item.table_name
   and c.column_name = item.column_name
), details as (
  select
    check_group,
    check_name,
    expected,
    actual,
    case when passed then 'PASS' else 'FAIL' end as result,
    passed
  from checks
)
select *
from (
  select
    check_group,
    check_name,
    expected,
    actual,
    result,
    null::bigint as passed_checks,
    null::bigint as failed_checks,
    null::bigint as total_checks
  from details

  union all

  select
    'FINAL',
    'P2_SUPABASE_SCHEMA_ACCEPTANCE',
    'PASS',
    case when bool_and(passed) then 'PASS' else 'FAIL' end,
    case when bool_and(passed) then 'PASS' else 'FAIL' end,
    count(*) filter (where passed),
    count(*) filter (where not passed),
    count(*)
  from details
) output
order by
  case when check_group = 'FINAL' then 1 else 0 end,
  check_group,
  check_name;
