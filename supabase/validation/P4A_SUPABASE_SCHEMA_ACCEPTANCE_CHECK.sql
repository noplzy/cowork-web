-- P4-A Supabase schema acceptance. Safe/read-only.
with checks as (
  select
    'rpc'::text as check_group,
    'cowork_room_friend_action_v4a exists'::text as check_name,
    true as expected,
    to_regprocedure('public.cowork_room_friend_action_v4a(uuid,uuid,uuid,text,text)') is not null as actual
  union all
  select 'rpc', 'cowork_room_owner_action_v4a exists', true,
    to_regprocedure('public.cowork_room_owner_action_v4a(uuid,uuid,text,uuid,boolean)') is not null
  union all
  select 'security', 'friend RPC is SECURITY DEFINER', true,
    coalesce((
      select p.prosecdef
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.oid = to_regprocedure('public.cowork_room_friend_action_v4a(uuid,uuid,uuid,text,text)')
    ), false)
  union all
  select 'security', 'owner RPC is SECURITY DEFINER', true,
    coalesce((
      select p.prosecdef
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.oid = to_regprocedure('public.cowork_room_owner_action_v4a(uuid,uuid,text,uuid,boolean)')
    ), false)
  union all
  select 'grant', 'anon cannot execute friend RPC', false,
    coalesce(has_function_privilege('anon', to_regprocedure('public.cowork_room_friend_action_v4a(uuid,uuid,uuid,text,text)'), 'EXECUTE'), false)
  union all
  select 'grant', 'authenticated cannot execute friend RPC', false,
    coalesce(has_function_privilege('authenticated', to_regprocedure('public.cowork_room_friend_action_v4a(uuid,uuid,uuid,text,text)'), 'EXECUTE'), false)
  union all
  select 'grant', 'service_role can execute friend RPC', true,
    coalesce(has_function_privilege('service_role', to_regprocedure('public.cowork_room_friend_action_v4a(uuid,uuid,uuid,text,text)'), 'EXECUTE'), false)
  union all
  select 'grant', 'anon cannot execute owner RPC', false,
    coalesce(has_function_privilege('anon', to_regprocedure('public.cowork_room_owner_action_v4a(uuid,uuid,text,uuid,boolean)'), 'EXECUTE'), false)
  union all
  select 'grant', 'authenticated cannot execute owner RPC', false,
    coalesce(has_function_privilege('authenticated', to_regprocedure('public.cowork_room_owner_action_v4a(uuid,uuid,text,uuid,boolean)'), 'EXECUTE'), false)
  union all
  select 'grant', 'service_role can execute owner RPC', true,
    coalesce(has_function_privilege('service_role', to_regprocedure('public.cowork_room_owner_action_v4a(uuid,uuid,text,uuid,boolean)'), 'EXECUTE'), false)
  union all
  select 'table', 'room_member_presence_state exists', true,
    to_regclass('public.room_member_presence_state') is not null
  union all
  select 'table', 'user_usage_wallets exists', true,
    to_regclass('public.user_usage_wallets') is not null
  union all
  select 'table', 'friend_requests exists', true,
    to_regclass('public.friend_requests') is not null
  union all
  select 'table', 'friendships exists', true,
    to_regclass('public.friendships') is not null
  union all
  select 'table', 'user_reports exists', true,
    to_regclass('public.user_reports') is not null
  union all
  select 'table', 'user_blocks relationship columns exist', true,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'user_blocks' and column_name = 'blocker_user_id'
    ) and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'user_blocks' and column_name = 'blocked_user_id'
    )
  union all
  select 'index', 'presence operational index exists', true,
    to_regclass('public.idx_p4a_presence_room_status_recent') is not null
  union all
  select 'index', 'identity approved index exists', true,
    to_regclass('public.idx_p4a_identity_approved_user') is not null
  union all
  select 'index', 'room reports index exists', true,
    to_regclass('public.idx_p4a_reports_room_target_created') is not null
  union all
  select 'index', 'wallet read-model index exists', true,
    to_regclass('public.idx_p4a_wallet_user_resource_period') is not null
), results as (
  select
    check_group,
    check_name,
    expected,
    actual,
    expected is not distinct from actual as passed
  from checks
)
select
  check_group,
  check_name,
  expected,
  actual,
  case when passed then 'PASS' else 'FAIL' end as result
from results
order by passed asc, check_group, check_name;

with checks as (
  select to_regprocedure('public.cowork_room_friend_action_v4a(uuid,uuid,uuid,text,text)') is not null as passed
  union all select to_regprocedure('public.cowork_room_owner_action_v4a(uuid,uuid,text,uuid,boolean)') is not null
  union all select not coalesce(has_function_privilege('anon', to_regprocedure('public.cowork_room_friend_action_v4a(uuid,uuid,uuid,text,text)'), 'EXECUTE'), false)
  union all select not coalesce(has_function_privilege('authenticated', to_regprocedure('public.cowork_room_friend_action_v4a(uuid,uuid,uuid,text,text)'), 'EXECUTE'), false)
  union all select coalesce(has_function_privilege('service_role', to_regprocedure('public.cowork_room_friend_action_v4a(uuid,uuid,uuid,text,text)'), 'EXECUTE'), false)
  union all select not coalesce(has_function_privilege('anon', to_regprocedure('public.cowork_room_owner_action_v4a(uuid,uuid,text,uuid,boolean)'), 'EXECUTE'), false)
  union all select not coalesce(has_function_privilege('authenticated', to_regprocedure('public.cowork_room_owner_action_v4a(uuid,uuid,text,uuid,boolean)'), 'EXECUTE'), false)
  union all select coalesce(has_function_privilege('service_role', to_regprocedure('public.cowork_room_owner_action_v4a(uuid,uuid,text,uuid,boolean)'), 'EXECUTE'), false)
  union all select to_regclass('public.idx_p4a_presence_room_status_recent') is not null
  union all select to_regclass('public.idx_p4a_identity_approved_user') is not null
  union all select to_regclass('public.idx_p4a_reports_room_target_created') is not null
  union all select to_regclass('public.idx_p4a_wallet_user_resource_period') is not null
)
select
  case when bool_and(passed) then 'PASS' else 'FAIL' end as "P4A_SUPABASE_SCHEMA_ACCEPTANCE",
  count(*) filter (where passed) as passed_checks,
  count(*) filter (where not passed) as failed_checks,
  count(*) as total_checks
from checks;
