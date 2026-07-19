-- DESTRUCTIVE ROLLBACK: do not run during normal deployment.
-- This deletes P1 appeal conversations/events and removes P1 appeal fields/RPCs.
-- P1 intentionally does not restore the legacy broad anon/authenticated table grants on appeals.
begin;
drop function if exists public.cowork_transition_appeal(uuid,uuid,text,text,text,boolean,jsonb);
drop function if exists public.cowork_close_appeal(uuid,uuid);
drop function if exists public.cowork_append_appeal_message(uuid,uuid,text,text,jsonb);
drop function if exists public.cowork_create_appeal(uuid,uuid,uuid,text,text,text,text,jsonb);
drop table if exists public.appeal_events cascade;
drop table if exists public.appeal_messages cascade;
drop index if exists public.appeals_user_idempotency_unique;
drop index if exists public.appeals_one_active_per_action;
drop index if exists public.appeals_one_active_per_case_without_action;
drop index if exists public.moderation_actions_one_restore_per_appeal;
drop index if exists public.idx_appeals_action_updated;
drop index if exists public.idx_appeals_case_updated;
alter table public.appeals drop constraint if exists appeals_resolution_action_id_fkey;
alter table public.appeals drop constraint if exists appeals_reason_code_check;
alter table public.appeals drop constraint if exists appeals_source_check;
alter table public.appeals drop constraint if exists appeals_requested_outcome_len;
alter table public.appeals drop constraint if exists appeals_decision_reason_len;
alter table public.appeals drop column if exists reason_code;
alter table public.appeals drop column if exists requested_outcome;
alter table public.appeals drop column if exists decision;
alter table public.appeals drop column if exists decision_reason;
alter table public.appeals drop column if exists resolution_action_id;
alter table public.appeals drop column if exists source;
alter table public.appeals drop column if exists idempotency_key;
alter table public.appeals drop column if exists metadata;
alter table public.appeals drop column if exists review_started_at;
alter table public.appeals drop column if exists last_user_message_at;
alter table public.appeals drop column if exists last_admin_message_at;
alter table public.appeals drop column if exists closed_at;
alter table public.appeals drop column if exists version;
commit;
