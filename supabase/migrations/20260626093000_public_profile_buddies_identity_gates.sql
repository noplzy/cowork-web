-- Calm&Co / 安感島 v118.1 hotfix
-- Public Profile + User Trust Surface + Buddies Service Detail + Identity Gates
--
-- Hotfix reason:
-- - v118 originally assumed user_identity_bindings(provider, verification_status).
-- - The actual v114 schema uses user_identity_bindings(binding_type, status).
-- - This migration now creates the correct index when those columns exist, and falls back safely.
--
-- Source of truth:
-- - Login email and phone verification remain Supabase auth.users.
-- - user_identity_bindings is only an account-facing binding/audit surface.

begin;

create extension if not exists pgcrypto with schema extensions;

alter table if exists public.profiles
  add column if not exists handle text,
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists bio text,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists is_professional_buddy boolean not null default false,
  add column if not exists public_profile_enabled boolean not null default true,
  add column if not exists profile_visibility text not null default 'public',
  add column if not exists public_contact_note text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists profiles_handle_unique_lower
  on public.profiles (lower(handle))
  where handle is not null and handle <> '';

create index if not exists idx_profiles_professional_buddy
  on public.profiles(is_professional_buddy, updated_at desc);

create index if not exists idx_identity_verification_requests_user_status
  on public.identity_verification_requests(user_id, review_status, updated_at desc);

-- Schema-compatible user_identity_bindings index.
-- v114 schema: binding_type + status.
-- Some future schema variants may use provider + verification_status; keep fallback to avoid breaking old production.
do $$
begin
  if to_regclass('public.user_identity_bindings') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'user_identity_bindings' and column_name = 'binding_type'
    ) and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'user_identity_bindings' and column_name = 'status'
    ) then
      execute 'create index if not exists idx_user_identity_bindings_user_type_status on public.user_identity_bindings(user_id, binding_type, status, updated_at desc)';
    elsif exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'user_identity_bindings' and column_name = 'provider'
    ) and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'user_identity_bindings' and column_name = 'verification_status'
    ) then
      execute 'create index if not exists idx_user_identity_bindings_user_provider_status on public.user_identity_bindings(user_id, provider, verification_status, updated_at desc)';
    else
      execute 'create index if not exists idx_user_identity_bindings_user_updated on public.user_identity_bindings(user_id, updated_at desc)';
    end if;
  end if;
end $$;

create index if not exists idx_buddy_services_active_visibility
  on public.buddy_services(status, visibility, updated_at desc);

create index if not exists idx_buddy_services_provider_status
  on public.buddy_services(provider_user_id, status, updated_at desc);

create index if not exists idx_buddy_service_slots_service_open
  on public.buddy_service_slots(service_id, slot_status, starts_at)
  where slot_status = 'open';

create index if not exists idx_buddy_reviews_service_created
  on public.buddy_reviews(service_id, created_at desc);

-- Client/browser should not read identity tables directly. Server routes with service_role decide the public trust surface.
alter table if exists public.identity_verification_requests enable row level security;
alter table if exists public.user_identity_bindings enable row level security;

select 'profiles' as check_name, count(*) as rows from public.profiles
union all
select 'buddy_services' as check_name, count(*) as rows from public.buddy_services
union all
select 'identity_verification_requests' as check_name, count(*) as rows from public.identity_verification_requests;

commit;
