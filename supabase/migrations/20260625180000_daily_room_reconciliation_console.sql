-- Calm&Co / 安感島 v117
-- Daily Room Reconciliation Console.

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.room_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null default 'manual_scan',
  status text not null default 'completed',
  scanned_supabase_rooms integer not null default 0,
  scanned_daily_rooms integer not null default 0,
  detected_items integer not null default 0,
  fixed_items integer not null default 0,
  failed_items integer not null default 0,
  triggered_by_admin_user_id uuid references auth.users(id) on delete set null,
  summary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint room_reconciliation_runs_type_check check (run_type = any (array['manual_scan','manual_fix','cleanup_cron','auto_scan'])),
  constraint room_reconciliation_runs_status_check check (status = any (array['running','completed','partial_failed','failed']))
);

create table if not exists public.room_reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.room_reconciliation_runs(id) on delete set null,
  issue_type text not null,
  severity text not null default 'normal',
  status text not null default 'open',
  room_id uuid references public.rooms(id) on delete set null,
  daily_room_name text,
  daily_room_url text,
  title text not null,
  description text,
  recommended_action text,
  fixed_by_admin_user_id uuid references auth.users(id) on delete set null,
  fixed_at timestamptz,
  fix_result jsonb,
  ignored_by_admin_user_id uuid references auth.users(id) on delete set null,
  ignored_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_reconciliation_items_issue_check check (issue_type = any (array['active_overdue','active_without_daily_url','active_daily_missing','ended_with_daily_room','orphan_daily_room','active_without_members','stale_presence','daily_list_failed'])),
  constraint room_reconciliation_items_severity_check check (severity = any (array['low','normal','high','urgent','critical'])),
  constraint room_reconciliation_items_status_check check (status = any (array['open','in_progress','fixed','ignored','failed']))
);

alter table public.room_reconciliation_runs
  add column if not exists run_type text not null default 'manual_scan',
  add column if not exists status text not null default 'completed',
  add column if not exists scanned_supabase_rooms integer not null default 0,
  add column if not exists scanned_daily_rooms integer not null default 0,
  add column if not exists detected_items integer not null default 0,
  add column if not exists fixed_items integer not null default 0,
  add column if not exists failed_items integer not null default 0,
  add column if not exists triggered_by_admin_user_id uuid references auth.users(id) on delete set null,
  add column if not exists summary jsonb not null default '{}'::jsonb,
  add column if not exists started_at timestamptz not null default now(),
  add column if not exists completed_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

alter table public.room_reconciliation_items
  add column if not exists run_id uuid references public.room_reconciliation_runs(id) on delete set null,
  add column if not exists issue_type text not null default 'active_overdue',
  add column if not exists severity text not null default 'normal',
  add column if not exists status text not null default 'open',
  add column if not exists room_id uuid references public.rooms(id) on delete set null,
  add column if not exists daily_room_name text,
  add column if not exists daily_room_url text,
  add column if not exists title text not null default 'Room reconciliation issue',
  add column if not exists description text,
  add column if not exists recommended_action text,
  add column if not exists fixed_by_admin_user_id uuid references auth.users(id) on delete set null,
  add column if not exists fixed_at timestamptz,
  add column if not exists fix_result jsonb,
  add column if not exists ignored_by_admin_user_id uuid references auth.users(id) on delete set null,
  add column if not exists ignored_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_room_reconciliation_runs_created on public.room_reconciliation_runs(created_at desc);
create index if not exists idx_room_reconciliation_items_status_created on public.room_reconciliation_items(status, severity, created_at desc);
create index if not exists idx_room_reconciliation_items_room on public.room_reconciliation_items(room_id, status, created_at desc) where room_id is not null;
create index if not exists idx_room_reconciliation_items_daily_name on public.room_reconciliation_items(daily_room_name, status, created_at desc) where daily_room_name is not null;

alter table public.room_reconciliation_runs enable row level security;
alter table public.room_reconciliation_items enable row level security;

select 'room_reconciliation_runs' as check_name, count(*) as rows from public.room_reconciliation_runs
union all
select 'room_reconciliation_items' as check_name, count(*) as rows from public.room_reconciliation_items;

commit;
