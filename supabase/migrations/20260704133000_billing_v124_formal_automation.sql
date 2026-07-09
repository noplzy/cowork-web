-- Calm&Co / 安感島 Billing V124 Formal Automation
-- Purpose: make billing automation schedulable, observable, and non-overlapping.
-- Safe to apply more than once. It does not mutate payment / invoice / refund business rows.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.billing_automation_locks (
  job_name text primary key,
  locked_until timestamptz not null,
  locked_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_automation_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null default 'billing_automation',
  status text not null check (status in ('running', 'completed', 'failed', 'skipped_locked')),
  trigger_source text,
  schedule text,
  user_agent text,
  build_tag text,
  automation_build_tag text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_automation_runs_job_started_idx
  on public.billing_automation_runs (job_name, started_at desc);

create index if not exists billing_automation_runs_status_started_idx
  on public.billing_automation_runs (status, started_at desc);

create or replace function public.billing_try_acquire_job_lock(
  p_job_name text,
  p_lock_seconds integer,
  p_locked_by uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acquired boolean;
begin
  if p_job_name is null or length(trim(p_job_name)) = 0 then
    raise exception 'missing_job_name';
  end if;
  if p_locked_by is null then
    raise exception 'missing_locked_by';
  end if;

  insert into public.billing_automation_locks (job_name, locked_until, locked_by, updated_at)
  values (p_job_name, now() + make_interval(secs => greatest(coalesce(p_lock_seconds, 60), 30)), p_locked_by, now())
  on conflict (job_name) do update
    set locked_until = excluded.locked_until,
        locked_by = excluded.locked_by,
        updated_at = now()
  where public.billing_automation_locks.locked_until <= now()
     or public.billing_automation_locks.locked_by = p_locked_by
  returning public.billing_automation_locks.locked_by = p_locked_by into v_acquired;

  return coalesce(v_acquired, false);
end;
$$;

create or replace function public.billing_release_job_lock(
  p_job_name text,
  p_locked_by uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_released boolean;
begin
  update public.billing_automation_locks
  set locked_until = now(),
      updated_at = now()
  where job_name = p_job_name
    and locked_by = p_locked_by
  returning true into v_released;

  return coalesce(v_released, false);
end;
$$;

revoke all on table public.billing_automation_locks from anon, authenticated;
revoke all on table public.billing_automation_runs from anon, authenticated;
revoke all on function public.billing_try_acquire_job_lock(text, integer, uuid) from anon, authenticated;
revoke all on function public.billing_release_job_lock(text, uuid) from anon, authenticated;
