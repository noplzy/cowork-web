-- Calm&Co / 安感島 P1 Schema Acceptance — no TEMP-table recovery edition
-- Use this file when the older P1 checker reports:
--   relation "p1_acceptance_results" does not exist
--
-- Cause: only the bottom SELECT was executed, or Supabase SQL Editor changed
-- database sessions after the temporary table was created.
--
-- Safe: read-only, one statement, no BEGIN/COMMIT and no temporary table.
-- Expected FINAL row: PASS and failed_checks = 0.

with checks as (
  select 'tables'::text as check_group,
         item.table_name as check_name,
         'exists'::text as expected,
         coalesce(to_regclass('public.' || item.table_name)::text, 'missing') as actual,
         to_regclass('public.' || item.table_name) is not null as passed
  from (values
    ('appeals'),
    ('appeal_messages'),
    ('appeal_events'),
    ('moderation_cases'),
    ('moderation_actions'),
    ('support_tickets'),
    ('support_ticket_messages'),
    ('support_ticket_events'),
    ('user_reports'),
    ('admin_audit_logs')
  ) item(table_name)

  union all
  select 'rls',
         item.table_name || '.enabled',
         'true',
         coalesce(c.relrowsecurity::text, 'table_missing'),
         coalesce(c.relrowsecurity, false)
  from (values ('appeal_messages'), ('appeal_events')) item(table_name)
  left join pg_namespace n
    on n.nspname = 'public'
  left join pg_class c
    on c.relnamespace = n.oid
   and c.relname = item.table_name
   and c.relkind = 'r'

  union all
  select 'rls',
         item.table_name || '.browser_policy_count',
         '0',
         count(p.policyname)::text,
         count(p.policyname) = 0
  from (values ('appeal_messages'), ('appeal_events')) item(table_name)
  left join pg_policies p
    on p.schemaname = 'public'
   and p.tablename = item.table_name
  group by item.table_name

  union all
  select 'table_privileges',
         role_name || '.' || table_name || '.select',
         'false',
         coalesce(
           has_table_privilege(
             role_name,
             to_regclass('public.' || table_name),
             'select'
           ),
           false
         )::text,
         not coalesce(
           has_table_privilege(
             role_name,
             to_regclass('public.' || table_name),
             'select'
           ),
           false
         )
  from (values ('anon'), ('authenticated')) roles(role_name)
  cross join (values
    ('appeals'),
    ('appeal_messages'),
    ('appeal_events'),
    ('support_tickets'),
    ('support_ticket_messages'),
    ('support_ticket_events'),
    ('user_reports'),
    ('moderation_cases'),
    ('moderation_actions')
  ) tables(table_name)

  union all
  select 'table_privileges',
         role_name || '.' || table_name || '.insert',
         'false',
         coalesce(
           has_table_privilege(
             role_name,
             to_regclass('public.' || table_name),
             'insert'
           ),
           false
         )::text,
         not coalesce(
           has_table_privilege(
             role_name,
             to_regclass('public.' || table_name),
             'insert'
           ),
           false
         )
  from (values ('anon'), ('authenticated')) roles(role_name)
  cross join (values
    ('appeals'),
    ('appeal_messages'),
    ('appeal_events'),
    ('support_tickets'),
    ('support_ticket_messages'),
    ('support_ticket_events'),
    ('user_reports'),
    ('moderation_cases'),
    ('moderation_actions')
  ) tables(table_name)

  union all
  select 'appeals_columns',
         item.column_name,
         'exists',
         case when c.column_name is null then 'missing' else 'exists' end,
         c.column_name is not null
  from (values
    ('reason_code'),
    ('requested_outcome'),
    ('decision'),
    ('decision_reason'),
    ('resolution_action_id'),
    ('source'),
    ('idempotency_key'),
    ('metadata'),
    ('review_started_at'),
    ('last_user_message_at'),
    ('last_admin_message_at'),
    ('closed_at'),
    ('version')
  ) item(column_name)
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = 'appeals'
   and c.column_name = item.column_name

  union all
  select 'indexes',
         item.index_name,
         'exists',
         coalesce(to_regclass('public.' || item.index_name)::text, 'missing'),
         to_regclass('public.' || item.index_name) is not null
  from (values
    ('idx_appeal_messages_appeal_created'),
    ('idx_appeal_events_appeal_created'),
    ('idx_appeals_action_updated'),
    ('idx_appeals_case_updated'),
    ('appeals_user_idempotency_unique'),
    ('appeals_one_active_per_action'),
    ('appeals_one_active_per_case_without_action'),
    ('moderation_actions_one_restore_per_appeal')
  ) item(index_name)

  union all
  select 'constraints',
         item.constraint_name,
         'exists',
         case when c.oid is null then 'missing' else 'exists' end,
         c.oid is not null
  from (values
    ('appeals_resolution_action_id_fkey'),
    ('appeals_reason_code_check'),
    ('appeals_source_check'),
    ('appeals_requested_outcome_len'),
    ('appeals_decision_reason_len')
  ) item(constraint_name)
  left join pg_constraint c
    on c.conname = item.constraint_name

  union all
  select 'triggers',
         'trg_appeals_updated_at',
         'exists',
         case when t.oid is null then 'missing' else 'exists' end,
         t.oid is not null
  from (select 1) seed
  left join pg_namespace n
    on n.nspname = 'public'
  left join pg_class c
    on c.relnamespace = n.oid
   and c.relname = 'appeals'
  left join pg_trigger t
    on t.tgrelid = c.oid
   and t.tgname = 'trg_appeals_updated_at'
   and not t.tgisinternal

  union all
  select 'rpcs',
         item.function_name,
         'exists',
         coalesce(to_regprocedure(item.signature)::text, 'missing'),
         to_regprocedure(item.signature) is not null
  from (values
    ('cowork_create_appeal',
      'public.cowork_create_appeal(uuid,uuid,uuid,text,text,text,text,jsonb)'),
    ('cowork_append_appeal_message',
      'public.cowork_append_appeal_message(uuid,uuid,text,text,jsonb)'),
    ('cowork_close_appeal',
      'public.cowork_close_appeal(uuid,uuid)'),
    ('cowork_transition_appeal',
      'public.cowork_transition_appeal(uuid,uuid,text,text,text,boolean,jsonb)')
  ) item(function_name, signature)

  union all
  select 'rpc_security',
         item.function_name || '.security_definer',
         'true',
         coalesce(p.prosecdef::text, 'function_missing'),
         coalesce(p.prosecdef, false)
  from (values
    ('cowork_create_appeal',
      'p_user_id uuid, p_moderation_case_id uuid, p_moderation_action_id uuid, p_reason_code text, p_message text, p_requested_outcome text, p_idempotency_key text, p_metadata jsonb'),
    ('cowork_append_appeal_message',
      'p_appeal_id uuid, p_actor_user_id uuid, p_actor_role text, p_body text, p_metadata jsonb'),
    ('cowork_close_appeal',
      'p_appeal_id uuid, p_user_id uuid'),
    ('cowork_transition_appeal',
      'p_appeal_id uuid, p_admin_user_id uuid, p_to_status text, p_admin_response text, p_decision_reason text, p_create_restore_action boolean, p_metadata jsonb')
  ) item(function_name, identity_arguments)
  left join pg_namespace n
    on n.nspname = 'public'
  left join pg_proc p
    on p.pronamespace = n.oid
   and p.proname = item.function_name
   and pg_get_function_identity_arguments(p.oid) = item.identity_arguments

  union all
  select 'rpc_privileges',
         role_name || '.' || item.function_name,
         case when role_name = 'service_role' then 'true' else 'false' end,
         coalesce(
           has_function_privilege(
             role_name,
             to_regprocedure(item.signature),
             'execute'
           ),
           false
         )::text,
         coalesce(
           has_function_privilege(
             role_name,
             to_regprocedure(item.signature),
             'execute'
           ),
           false
         ) = (role_name = 'service_role')
  from (values ('anon'), ('authenticated'), ('service_role')) roles(role_name)
  cross join (values
    ('cowork_create_appeal',
      'public.cowork_create_appeal(uuid,uuid,uuid,text,text,text,text,jsonb)'),
    ('cowork_append_appeal_message',
      'public.cowork_append_appeal_message(uuid,uuid,text,text,jsonb)'),
    ('cowork_close_appeal',
      'public.cowork_close_appeal(uuid,uuid)'),
    ('cowork_transition_appeal',
      'public.cowork_transition_appeal(uuid,uuid,text,text,text,boolean,jsonb)')
  ) item(function_name, signature)
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
    'P1_SUPABASE_SCHEMA_ACCEPTANCE',
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
