-- Calm&Co / 安感島 P1 Trust & Operations Closure
-- Schema and privilege acceptance check (read-only except temporary table).
-- Expected final result:
--   P1_SUPABASE_SCHEMA_ACCEPTANCE = PASS
--   failed_checks = 0

begin;

drop table if exists p1_acceptance_results;
create temporary table p1_acceptance_results (
  check_group text not null,
  check_name text not null,
  expected text not null,
  actual text not null,
  passed boolean not null
) on commit preserve rows;

-- ---------------------------------------------------------------------------
-- 1. Existing and new tables
-- ---------------------------------------------------------------------------
insert into p1_acceptance_results
select
  'tables',
  item.table_name,
  'exists',
  coalesce(to_regclass('public.' || item.table_name)::text, 'missing'),
  to_regclass('public.' || item.table_name) is not null
from (
  values
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
) as item(table_name);

-- ---------------------------------------------------------------------------
-- 2. RLS and browser privileges for P1 conversation/event tables
-- ---------------------------------------------------------------------------
insert into p1_acceptance_results
select
  'rls',
  item.table_name || '.enabled',
  'true',
  coalesce(c.relrowsecurity::text, 'table_missing'),
  coalesce(c.relrowsecurity, false)
from (values ('appeal_messages'), ('appeal_events')) as item(table_name)
left join pg_namespace n on n.nspname = 'public'
left join pg_class c
  on c.relnamespace = n.oid
 and c.relname = item.table_name
 and c.relkind = 'r';

insert into p1_acceptance_results
select
  'rls',
  item.table_name || '.browser_policy_count',
  '0',
  count(p.policyname)::text,
  count(p.policyname) = 0
from (values ('appeal_messages'), ('appeal_events')) as item(table_name)
left join pg_policies p
  on p.schemaname = 'public'
 and p.tablename = item.table_name
group by item.table_name;

insert into p1_acceptance_results
select
  'table_privileges',
  role_name || '.' || table_name || '.select',
  'false',
  coalesce(has_table_privilege(role_name, to_regclass('public.' || table_name), 'select'), false)::text,
  not coalesce(has_table_privilege(role_name, to_regclass('public.' || table_name), 'select'), false)
from (values ('anon'), ('authenticated')) as roles(role_name)
cross join (values ('appeals'), ('appeal_messages'), ('appeal_events'), ('support_tickets'), ('support_ticket_messages'), ('support_ticket_events'), ('user_reports'), ('moderation_cases'), ('moderation_actions')) as tables(table_name);

insert into p1_acceptance_results
select
  'table_privileges',
  role_name || '.' || table_name || '.insert',
  'false',
  coalesce(has_table_privilege(role_name, to_regclass('public.' || table_name), 'insert'), false)::text,
  not coalesce(has_table_privilege(role_name, to_regclass('public.' || table_name), 'insert'), false)
from (values ('anon'), ('authenticated')) as roles(role_name)
cross join (values ('appeals'), ('appeal_messages'), ('appeal_events'), ('support_tickets'), ('support_ticket_messages'), ('support_ticket_events'), ('user_reports'), ('moderation_cases'), ('moderation_actions')) as tables(table_name);

-- ---------------------------------------------------------------------------
-- 3. Required columns on appeals
-- ---------------------------------------------------------------------------
insert into p1_acceptance_results
select
  'appeals_columns',
  item.column_name,
  'exists',
  case when c.column_name is null then 'missing' else 'exists' end,
  c.column_name is not null
from (
  values
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
) as item(column_name)
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = 'appeals'
 and c.column_name = item.column_name;

-- ---------------------------------------------------------------------------
-- 4. Required indexes and constraints
-- ---------------------------------------------------------------------------
insert into p1_acceptance_results
select
  'indexes',
  item.index_name,
  'exists',
  coalesce(to_regclass('public.' || item.index_name)::text, 'missing'),
  to_regclass('public.' || item.index_name) is not null
from (
  values
    ('idx_appeal_messages_appeal_created'),
    ('idx_appeal_events_appeal_created'),
    ('idx_appeals_action_updated'),
    ('idx_appeals_case_updated'),
    ('appeals_user_idempotency_unique'),
    ('appeals_one_active_per_action'),
    ('appeals_one_active_per_case_without_action'),
    ('moderation_actions_one_restore_per_appeal')
) as item(index_name);

insert into p1_acceptance_results
select
  'constraints',
  item.constraint_name,
  'exists',
  case when c.oid is null then 'missing' else 'exists' end,
  c.oid is not null
from (
  values
    ('appeals_resolution_action_id_fkey'),
    ('appeals_reason_code_check'),
    ('appeals_source_check'),
    ('appeals_requested_outcome_len'),
    ('appeals_decision_reason_len')
) as item(constraint_name)
left join pg_constraint c on c.conname = item.constraint_name;

insert into p1_acceptance_results
select
  'triggers',
  'trg_appeals_updated_at',
  'exists',
  case when t.oid is null then 'missing' else 'exists' end,
  t.oid is not null
from (select 1) seed
left join pg_namespace n on n.nspname = 'public'
left join pg_class c on c.relnamespace = n.oid and c.relname = 'appeals'
left join pg_trigger t
  on t.tgrelid = c.oid
 and t.tgname = 'trg_appeals_updated_at'
 and not t.tgisinternal;

-- ---------------------------------------------------------------------------
-- 5. Service-role-only RPCs
-- ---------------------------------------------------------------------------
insert into p1_acceptance_results
select
  'rpcs',
  item.function_name,
  'exists',
  coalesce(to_regprocedure(item.signature)::text, 'missing'),
  to_regprocedure(item.signature) is not null
from (
  values
    ('cowork_create_appeal', 'public.cowork_create_appeal(uuid,uuid,uuid,text,text,text,text,jsonb)'),
    ('cowork_append_appeal_message', 'public.cowork_append_appeal_message(uuid,uuid,text,text,jsonb)'),
    ('cowork_close_appeal', 'public.cowork_close_appeal(uuid,uuid)'),
    ('cowork_transition_appeal', 'public.cowork_transition_appeal(uuid,uuid,text,text,text,boolean,jsonb)')
) as item(function_name, signature);

insert into p1_acceptance_results
select
  'rpc_security',
  item.function_name || '.security_definer',
  'true',
  coalesce(p.prosecdef::text, 'function_missing'),
  coalesce(p.prosecdef, false)
from (
  values
    ('cowork_create_appeal', 'p_user_id uuid, p_moderation_case_id uuid, p_moderation_action_id uuid, p_reason_code text, p_message text, p_requested_outcome text, p_idempotency_key text, p_metadata jsonb'),
    ('cowork_append_appeal_message', 'p_appeal_id uuid, p_actor_user_id uuid, p_actor_role text, p_body text, p_metadata jsonb'),
    ('cowork_close_appeal', 'p_appeal_id uuid, p_user_id uuid'),
    ('cowork_transition_appeal', 'p_appeal_id uuid, p_admin_user_id uuid, p_to_status text, p_admin_response text, p_decision_reason text, p_create_restore_action boolean, p_metadata jsonb')
) as item(function_name, identity_arguments)
left join pg_namespace n on n.nspname = 'public'
left join pg_proc p
  on p.pronamespace = n.oid
 and p.proname = item.function_name
 and pg_get_function_identity_arguments(p.oid) = item.identity_arguments;

insert into p1_acceptance_results
select
  'rpc_privileges',
  role_name || '.' || function_name,
  expected,
  actual::text,
  actual = expected::boolean
from (
  select
    role_name,
    item.function_name,
    case when role_name = 'service_role' then 'true' else 'false' end as expected,
    coalesce(has_function_privilege(role_name, to_regprocedure(item.signature), 'execute'), false) as actual
  from (values ('anon'), ('authenticated'), ('service_role')) as roles(role_name)
  cross join (
    values
      ('cowork_create_appeal', 'public.cowork_create_appeal(uuid,uuid,uuid,text,text,text,text,jsonb)'),
      ('cowork_append_appeal_message', 'public.cowork_append_appeal_message(uuid,uuid,text,text,jsonb)'),
      ('cowork_close_appeal', 'public.cowork_close_appeal(uuid,uuid)'),
      ('cowork_transition_appeal', 'public.cowork_transition_appeal(uuid,uuid,text,text,text,boolean,jsonb)')
  ) as item(function_name, signature)
) privilege_rows;

-- ---------------------------------------------------------------------------
-- 6. Detailed result and summary
-- ---------------------------------------------------------------------------
select
  check_group,
  check_name,
  expected,
  actual,
  case when passed then 'PASS' else 'FAIL' end as result
from p1_acceptance_results
order by passed asc, check_group, check_name;

select
  case when bool_and(passed) then 'PASS' else 'FAIL' end as "P1_SUPABASE_SCHEMA_ACCEPTANCE",
  count(*) filter (where passed) as passed_checks,
  count(*) filter (where not passed) as failed_checks,
  count(*) as total_checks
from p1_acceptance_results;

drop table if exists p1_acceptance_results;
commit;
