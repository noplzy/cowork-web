-- DESTRUCTIVE ROLLBACK — only use before P0 production data has value.
-- Preferred rollback is code revert while leaving additive schema in place.

begin;

drop function if exists public.cowork_apply_presence_usage(
  uuid, integer, text, text, boolean, boolean
);

drop table if exists public.room_participant_summaries;
drop table if exists public.room_session_summaries;
drop table if exists public.room_extension_confirmations;
drop table if exists public.room_member_presence_state;

alter table public.room_presence_events
  drop column if exists daily_participant_state,
  drop column if exists billing_media_class;

alter table public.room_access_sessions
  drop column if exists connected_at,
  drop column if exists disconnected_at,
  drop column if exists connected_seconds,
  drop column if exists visual_seconds,
  drop column if exists audio_only_seconds,
  drop column if exists screen_share_seconds,
  drop column if exists billing_media_class,
  drop column if exists billable_participant_minutes,
  drop column if exists estimated_provider_cost_usd,
  drop column if exists usage_status,
  drop column if exists reconciled_at,
  drop column if exists reconciliation_source;

drop function if exists public.cowork_p0_touch_updated_at();

commit;
