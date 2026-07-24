-- P4-A rollback. This removes only P4-A functions/indexes; it does not delete user data.
begin;

drop function if exists public.cowork_room_friend_action_v4a(uuid, uuid, uuid, text, text);
drop function if exists public.cowork_room_owner_action_v4a(uuid, uuid, text, uuid, boolean);

drop index if exists public.idx_p4a_presence_room_status_recent;
drop index if exists public.idx_p4a_identity_approved_user;
drop index if exists public.idx_p4a_reports_room_target_created;
drop index if exists public.idx_p4a_wallet_user_resource_period;

commit;
