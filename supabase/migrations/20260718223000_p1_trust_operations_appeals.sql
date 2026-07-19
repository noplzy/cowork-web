-- Calm&Co / 安感島 P1 Trust & Operations Closure
-- Build: 20260718223000_p1_trust_operations_appeals
-- Apply in Supabase SQL Editor or migration runner. Do NOT run rollback during normal deployment.

begin;

alter table public.appeals add column if not exists reason_code text not null default 'other';
alter table public.appeals add column if not exists requested_outcome text;
alter table public.appeals add column if not exists decision text;
alter table public.appeals add column if not exists decision_reason text;
alter table public.appeals add column if not exists resolution_action_id uuid;
alter table public.appeals add column if not exists source text not null default 'user';
alter table public.appeals add column if not exists idempotency_key text;
alter table public.appeals add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.appeals add column if not exists review_started_at timestamptz;
alter table public.appeals add column if not exists last_user_message_at timestamptz;
alter table public.appeals add column if not exists last_admin_message_at timestamptz;
alter table public.appeals add column if not exists closed_at timestamptz;
alter table public.appeals add column if not exists version integer not null default 1;

create table if not exists public.appeal_messages (
  id uuid primary key default gen_random_uuid(),
  appeal_id uuid not null references public.appeals(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_role text not null default 'user',
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint appeal_messages_sender_role_check check (sender_role in ('user','admin','system')),
  constraint appeal_messages_body_len check (char_length(body) between 1 and 6000)
);

create table if not exists public.appeal_events (
  id uuid primary key default gen_random_uuid(),
  appeal_id uuid not null references public.appeals(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text not null default 'system',
  event_type text not null,
  from_status text,
  to_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint appeal_events_actor_role_check check (actor_role in ('user','admin','system'))
);

alter table public.appeal_messages enable row level security;
alter table public.appeal_events enable row level security;
-- Trust & operations reads/writes go through authenticated server routes.
-- Revoke the legacy broad table grants so internal notes, actor UUIDs and metadata
-- cannot be selected or mutated directly from the browser.
revoke all on table public.appeals from public, anon, authenticated;
revoke all on table public.appeal_messages from public, anon, authenticated;
revoke all on table public.appeal_events from public, anon, authenticated;
revoke all on table public.support_tickets from public, anon, authenticated;
revoke all on table public.support_ticket_messages from public, anon, authenticated;
revoke all on table public.support_ticket_events from public, anon, authenticated;
revoke all on table public.user_reports from public, anon, authenticated;
revoke all on table public.moderation_cases from public, anon, authenticated;
revoke all on table public.moderation_actions from public, anon, authenticated;
grant all on table public.appeals to service_role;
grant all on table public.appeal_messages to service_role;
grant all on table public.appeal_events to service_role;
grant all on table public.support_tickets to service_role;
grant all on table public.support_ticket_messages to service_role;
grant all on table public.support_ticket_events to service_role;
grant all on table public.user_reports to service_role;
grant all on table public.moderation_cases to service_role;
grant all on table public.moderation_actions to service_role;

create index if not exists idx_appeal_messages_appeal_created on public.appeal_messages(appeal_id, created_at);
create index if not exists idx_appeal_events_appeal_created on public.appeal_events(appeal_id, created_at desc);
create index if not exists idx_appeals_action_updated on public.appeals(moderation_action_id, updated_at desc) where moderation_action_id is not null;
create index if not exists idx_appeals_case_updated on public.appeals(moderation_case_id, updated_at desc) where moderation_case_id is not null;
create unique index if not exists appeals_user_idempotency_unique on public.appeals(user_id, idempotency_key) where idempotency_key is not null;
create unique index if not exists appeals_one_active_per_action on public.appeals(user_id, moderation_action_id) where moderation_action_id is not null and status in ('open','reviewing');
create unique index if not exists appeals_one_active_per_case_without_action on public.appeals(user_id, moderation_case_id) where moderation_action_id is null and moderation_case_id is not null and status in ('open','reviewing');
create unique index if not exists moderation_actions_one_restore_per_appeal on public.moderation_actions ((metadata ->> 'appeal_id')) where action_type = 'restore' and metadata ->> 'source' = 'appeal_resolution' and metadata ->> 'appeal_id' is not null;

-- Preserve any legacy appeal rows created before the P1 message/event model.
update public.appeals
set
  last_user_message_at = coalesce(last_user_message_at, created_at),
  decision = case when status in ('accepted','rejected') then status else decision end,
  review_started_at = case when status in ('reviewing','accepted','rejected') then coalesce(review_started_at, updated_at, created_at) else review_started_at end,
  resolved_at = case when status in ('accepted','rejected') then coalesce(resolved_at, updated_at, created_at) else resolved_at end,
  closed_at = case when status = 'closed' then coalesce(closed_at, updated_at, created_at) else closed_at end
where last_user_message_at is null
   or (status in ('accepted','rejected') and decision is null)
   or (status in ('reviewing','accepted','rejected') and review_started_at is null)
   or (status = 'closed' and closed_at is null);

insert into public.appeal_messages(appeal_id, sender_user_id, sender_role, body, metadata, created_at)
select a.id, a.user_id, 'user', a.message, jsonb_build_object('source','legacy_appeal_backfill'), a.created_at
from public.appeals a
where not exists (
  select 1 from public.appeal_messages m where m.appeal_id = a.id
);

insert into public.appeal_events(appeal_id, actor_user_id, actor_role, event_type, to_status, metadata, created_at)
select a.id, a.user_id, 'system', 'appeal_legacy_imported', a.status, jsonb_build_object('source','p1_v129_migration'), a.created_at
from public.appeals a
where not exists (
  select 1 from public.appeal_events e where e.appeal_id = a.id and e.event_type = 'appeal_legacy_imported'
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appeals_resolution_action_id_fkey') THEN
    ALTER TABLE public.appeals ADD CONSTRAINT appeals_resolution_action_id_fkey FOREIGN KEY (resolution_action_id) REFERENCES public.moderation_actions(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appeals_reason_code_check') THEN
    ALTER TABLE public.appeals ADD CONSTRAINT appeals_reason_code_check CHECK (reason_code IN ('mistaken_identity','missing_context','incorrect_facts','disproportionate_action','resolved_issue','other')) NOT VALID;
    ALTER TABLE public.appeals VALIDATE CONSTRAINT appeals_reason_code_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appeals_source_check') THEN
    ALTER TABLE public.appeals ADD CONSTRAINT appeals_source_check CHECK (source IN ('user','admin','system')) NOT VALID;
    ALTER TABLE public.appeals VALIDATE CONSTRAINT appeals_source_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appeals_requested_outcome_len') THEN
    ALTER TABLE public.appeals ADD CONSTRAINT appeals_requested_outcome_len CHECK (requested_outcome IS NULL OR char_length(requested_outcome) <= 1000) NOT VALID;
    ALTER TABLE public.appeals VALIDATE CONSTRAINT appeals_requested_outcome_len;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appeals_decision_reason_len') THEN
    ALTER TABLE public.appeals ADD CONSTRAINT appeals_decision_reason_len CHECK (decision_reason IS NULL OR char_length(decision_reason) <= 3000) NOT VALID;
    ALTER TABLE public.appeals VALIDATE CONSTRAINT appeals_decision_reason_len;
  END IF;
END $$;

create or replace function public.calmco_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_appeals_updated_at on public.appeals;
create trigger trg_appeals_updated_at before update on public.appeals for each row execute function public.calmco_touch_updated_at();

create or replace function public.cowork_create_appeal(
  p_user_id uuid,
  p_moderation_case_id uuid,
  p_moderation_action_id uuid,
  p_reason_code text,
  p_message text,
  p_requested_outcome text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_case_id uuid := p_moderation_case_id;
  v_target_user_id uuid;
  v_existing public.appeals%rowtype;
  v_appeal public.appeals%rowtype;
begin
  if p_user_id is null then raise exception 'Missing user'; end if;
  if p_message is null or char_length(trim(p_message)) < 10 or char_length(p_message) > 6000 then raise exception 'Appeal message must be 10-6000 characters'; end if;
  if p_moderation_action_id is null and p_moderation_case_id is null then raise exception 'Appeal requires moderation case or action'; end if;

  if p_moderation_action_id is not null then
    select case_id, target_user_id into v_case_id, v_target_user_id from public.moderation_actions where id = p_moderation_action_id;
    if not found then raise exception 'Moderation action not found'; end if;
    if v_target_user_id is distinct from p_user_id then raise exception 'Moderation action does not target this user'; end if;
    if p_moderation_case_id is not null and p_moderation_case_id is distinct from v_case_id then raise exception 'Moderation case/action mismatch'; end if;
  else
    select target_user_id into v_target_user_id from public.moderation_cases where id = p_moderation_case_id;
    if not found then raise exception 'Moderation case not found'; end if;
    if v_target_user_id is distinct from p_user_id then raise exception 'Moderation case does not target this user'; end if;
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from public.appeals where user_id = p_user_id and idempotency_key = p_idempotency_key limit 1;
    if found then return jsonb_build_object('appeal', to_jsonb(v_existing), 'created', false); end if;
  end if;

  select * into v_existing from public.appeals
  where user_id = p_user_id and status in ('open','reviewing') and (
    (p_moderation_action_id is not null and moderation_action_id = p_moderation_action_id) or
    (p_moderation_action_id is null and moderation_action_id is null and moderation_case_id = v_case_id)
  ) limit 1;
  if found then return jsonb_build_object('appeal', to_jsonb(v_existing), 'created', false); end if;

  insert into public.appeals(user_id, moderation_case_id, moderation_action_id, status, message, reason_code, requested_outcome, source, idempotency_key, metadata, last_user_message_at)
  values(p_user_id, v_case_id, p_moderation_action_id, 'open', trim(p_message), coalesce(p_reason_code,'other'), nullif(trim(p_requested_outcome),''), 'user', nullif(trim(p_idempotency_key),''), coalesce(p_metadata,'{}'::jsonb), now())
  returning * into v_appeal;

  insert into public.appeal_messages(appeal_id, sender_user_id, sender_role, body, metadata) values(v_appeal.id, p_user_id, 'user', trim(p_message), '{}'::jsonb);
  insert into public.appeal_events(appeal_id, actor_user_id, actor_role, event_type, to_status, metadata) values(v_appeal.id, p_user_id, 'user', 'appeal_created', 'open', jsonb_build_object('reason_code',v_appeal.reason_code));
  return jsonb_build_object('appeal', to_jsonb(v_appeal), 'created', true);
exception when unique_violation then
  select * into v_existing from public.appeals where user_id = p_user_id and ((p_idempotency_key is not null and idempotency_key = p_idempotency_key) or (p_moderation_action_id is not null and moderation_action_id = p_moderation_action_id and status in ('open','reviewing')) or (p_moderation_action_id is null and moderation_action_id is null and moderation_case_id = v_case_id and status in ('open','reviewing'))) order by updated_at desc limit 1;
  if found then return jsonb_build_object('appeal', to_jsonb(v_existing), 'created', false); end if;
  raise;
end;
$$;

create or replace function public.cowork_append_appeal_message(
  p_appeal_id uuid,
  p_actor_user_id uuid,
  p_actor_role text,
  p_body text,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_appeal public.appeals%rowtype; v_message public.appeal_messages%rowtype;
begin
  if p_actor_role not in ('user','admin') then raise exception 'Invalid actor role'; end if;
  if p_body is null or char_length(trim(p_body)) < 1 or char_length(p_body) > 6000 then raise exception 'Message must be 1-6000 characters'; end if;
  select * into v_appeal from public.appeals where id = p_appeal_id for update;
  if not found then raise exception 'Appeal not found'; end if;
  if p_actor_role = 'user' and v_appeal.user_id is distinct from p_actor_user_id then raise exception 'Appeal does not belong to this user'; end if;
  if p_actor_role = 'user' and v_appeal.status not in ('open','reviewing') then raise exception 'Appeal is not open for user messages'; end if;
  insert into public.appeal_messages(appeal_id,sender_user_id,sender_role,body,metadata) values(p_appeal_id,p_actor_user_id,p_actor_role,trim(p_body),coalesce(p_metadata,'{}'::jsonb)) returning * into v_message;
  update public.appeals set last_user_message_at = case when p_actor_role='user' then now() else last_user_message_at end, last_admin_message_at = case when p_actor_role='admin' then now() else last_admin_message_at end, version = version + 1 where id = p_appeal_id;
  insert into public.appeal_events(appeal_id,actor_user_id,actor_role,event_type,from_status,to_status,metadata) values(p_appeal_id,p_actor_user_id,p_actor_role,'appeal_message_added',v_appeal.status,v_appeal.status,jsonb_build_object('message_id',v_message.id));
  return jsonb_build_object('message',to_jsonb(v_message));
end;
$$;

create or replace function public.cowork_close_appeal(p_appeal_id uuid, p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_appeal public.appeals%rowtype; v_from text;
begin
  select * into v_appeal from public.appeals where id=p_appeal_id for update;
  if not found then raise exception 'Appeal not found'; end if;
  if v_appeal.user_id is distinct from p_user_id then raise exception 'Appeal does not belong to this user'; end if;
  if v_appeal.status not in ('open','reviewing') then raise exception 'Appeal cannot be closed from current status'; end if;
  v_from := v_appeal.status;
  update public.appeals set status='closed', closed_at=now(), version=version+1 where id=p_appeal_id returning * into v_appeal;
  insert into public.appeal_events(appeal_id,actor_user_id,actor_role,event_type,from_status,to_status) values(p_appeal_id,p_user_id,'user','appeal_closed_by_user',v_from,'closed');
  return jsonb_build_object('appeal',to_jsonb(v_appeal));
end;
$$;

create or replace function public.cowork_transition_appeal(
  p_appeal_id uuid,
  p_admin_user_id uuid,
  p_to_status text,
  p_admin_response text,
  p_decision_reason text,
  p_create_restore_action boolean default false,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_appeal public.appeals%rowtype; v_from text; v_restore_id uuid;
begin
  select * into v_appeal from public.appeals where id=p_appeal_id for update;
  if not found then raise exception 'Appeal not found'; end if;
  v_from := v_appeal.status;
  if p_to_status not in ('reviewing','accepted','rejected','closed') then raise exception 'Invalid appeal status'; end if;
  if p_to_status is distinct from v_from and not (
    (v_from = 'open' and p_to_status in ('reviewing','closed')) or
    (v_from = 'reviewing' and p_to_status in ('accepted','rejected','closed')) or
    (v_from in ('accepted','rejected','closed') and p_to_status = 'reviewing') or
    (v_from in ('accepted','rejected') and p_to_status = 'closed')
  ) then raise exception 'Invalid appeal status transition from % to %', v_from, p_to_status; end if;
  if p_to_status in ('accepted','rejected') and (p_admin_response is null or char_length(trim(p_admin_response))=0) then raise exception 'Admin response is required'; end if;
  if p_create_restore_action and p_to_status <> 'accepted' then raise exception 'Restore action is only allowed for accepted appeals'; end if;
  if p_create_restore_action then
    if v_appeal.resolution_action_id is not null then
      v_restore_id := v_appeal.resolution_action_id;
    else
      insert into public.moderation_actions(case_id,actor_admin_user_id,target_user_id,action_type,reason,metadata)
      values(v_appeal.moderation_case_id,p_admin_user_id,v_appeal.user_id,'restore',coalesce(nullif(trim(p_admin_response),''),'Appeal accepted'),jsonb_build_object('appeal_id',p_appeal_id,'source','appeal_resolution')) returning id into v_restore_id;
    end if;
  end if;
  update public.appeals set
    status=p_to_status,
    admin_response=coalesce(nullif(trim(p_admin_response),''),admin_response),
    decision=case when p_to_status in ('accepted','rejected') then p_to_status when p_to_status='reviewing' then null else decision end,
    decision_reason=case when p_to_status='reviewing' then null else coalesce(nullif(trim(p_decision_reason),''),decision_reason) end,
    resolution_action_id=coalesce(v_restore_id,resolution_action_id),
    resolved_by_admin_user_id=p_admin_user_id,
    review_started_at=case when p_to_status='reviewing' then coalesce(review_started_at,now()) else review_started_at end,
    resolved_at=case when p_to_status in ('accepted','rejected') then now() when p_to_status='reviewing' then null else resolved_at end,
    closed_at=case when p_to_status='closed' then now() when p_to_status='reviewing' then null else closed_at end,
    last_admin_message_at=case when p_admin_response is not null and char_length(trim(p_admin_response))>0 then now() else last_admin_message_at end,
    metadata=coalesce(metadata,'{}'::jsonb)||coalesce(p_metadata,'{}'::jsonb),
    version=version+1
  where id=p_appeal_id returning * into v_appeal;
  if p_admin_response is not null and char_length(trim(p_admin_response))>0 then insert into public.appeal_messages(appeal_id,sender_user_id,sender_role,body,metadata) values(p_appeal_id,p_admin_user_id,'admin',trim(p_admin_response),jsonb_build_object('decision_status',p_to_status)); end if;
  insert into public.appeal_events(appeal_id,actor_user_id,actor_role,event_type,from_status,to_status,metadata) values(p_appeal_id,p_admin_user_id,'admin','appeal_status_changed',v_from,p_to_status,jsonb_build_object('restore_action_id',v_restore_id,'decision_reason',p_decision_reason));
  return jsonb_build_object('appeal',to_jsonb(v_appeal),'restore_action_id',v_restore_id);
end;
$$;

revoke all on function public.cowork_create_appeal(uuid,uuid,uuid,text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.cowork_append_appeal_message(uuid,uuid,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.cowork_close_appeal(uuid,uuid) from public, anon, authenticated;
revoke all on function public.cowork_transition_appeal(uuid,uuid,text,text,text,boolean,jsonb) from public, anon, authenticated;
grant execute on function public.cowork_create_appeal(uuid,uuid,uuid,text,text,text,text,jsonb) to service_role;
grant execute on function public.cowork_append_appeal_message(uuid,uuid,text,text,jsonb) to service_role;
grant execute on function public.cowork_close_appeal(uuid,uuid) to service_role;
grant execute on function public.cowork_transition_appeal(uuid,uuid,text,text,text,boolean,jsonb) to service_role;

commit;
