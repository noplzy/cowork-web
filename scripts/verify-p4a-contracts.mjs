import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const checks = [];
const failures = [];

function file(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) throw new Error(`Missing file: ${rel}`);
  return fs.readFileSync(full, "utf8");
}

function check(name, passed, detail = "") {
  checks.push({ name, passed, detail });
  if (!passed) failures.push({ name, detail });
}

function includes(rel, tokens) {
  const content = file(rel);
  for (const token of tokens) {
    check(`${rel} contains ${token}`, content.includes(token), token);
  }
}

const requiredFiles = [
  "lib/p4aStatus.ts",
  "lib/server/roomOperationalSnapshot.ts",
  "app/api/rooms/[roomId]/operations/route.ts",
  "app/api/rooms/[roomId]/relationships/route.ts",
  "app/api/rooms/[roomId]/moderation/route.ts",
  "app/api/rooms/[roomId]/owner/route.ts",
  "app/api/daily/meeting-token/route.ts",
  "app/rooms/[roomId]/layout.tsx",
  "components/rooms/RoomOperationalDock.tsx",
  "components/rooms/RoomOperationalDock.module.css",
  "supabase/migrations/20260724143000_p4a_rooms_operational_ux.sql",
  "supabase/validation/P4A_SUPABASE_SCHEMA_ACCEPTANCE_CHECK.sql",
  "supabase/validation/P4A_SUPABASE_RUNTIME_ACCEPTANCE_CHECK.sql",
  "supabase/rollback/20260724143000_p4a_rooms_operational_ux_rollback.sql",
  "docs/P4A_VALIDATION_RUNBOOK.md",
];
for (const rel of requiredFiles) {
  check(`required file ${rel}`, fs.existsSync(path.join(root, rel)), rel);
}

includes("app/api/daily/meeting-token/route.ts", [
  "user_id: userId",
  "daily_user_id: userId",
  "start_video_off: true",
  "start_audio_off: true",
  "eject_at_token_exp: true",
  "daily-room-user-identity-v140-2026-07-24",
]);

includes("lib/server/roomOperationalSnapshot.ts", [
  "scheduled_end_at",
  "room_member_presence_state",
  "getRoomCommercialState",
  "friend_requests",
  "friendships",
  "user_blocks",
  "identity_verification_requests",
  "public_profile_url",
  "visual_remaining_minutes",
  "extension_points_remaining",
  "current_participant_count",
]);

includes("components/rooms/RoomOperationalDock.tsx", [
  "房間剩餘",
  "房內成員",
  "查看公開頁面",
  "加好友",
  "檢舉",
  "封鎖",
  "移出房間",
  "結束整個房間",
  "getCallInstance",
  "updateParticipant",
  "eject: true",
  "data-p4a-build",
]);

includes("app/api/rooms/[roomId]/relationships/route.ts", [
  "getAuthUserFromRequest",
  "cowork_room_friend_action_v4a",
  "P4A_BUILD_TAGS.relationships",
]);

includes("app/api/rooms/[roomId]/moderation/route.ts", [
  "assertRoomOperationalMembership",
  "user_reports",
  "target_room_id: roomId",
  "insertReliabilityEvent",
]);

includes("app/api/rooms/[roomId]/owner/route.ts", [
  "cowork_room_owner_action_v4a",
  "tryDeleteDailyRoom",
  "client_eject_confirmed",
]);

const sql = file("supabase/migrations/20260724143000_p4a_rooms_operational_ux.sql");
for (const rpc of [
  "cowork_room_friend_action_v4a",
  "cowork_room_owner_action_v4a",
]) {
  check(`migration creates ${rpc}`, sql.includes(`function public.${rpc}`));
  check(
    `migration revokes browser execute ${rpc}`,
    sql.includes(`revoke all on function public.${rpc}`),
  );
  check(
    `migration grants service_role ${rpc}`,
    sql.includes(`grant execute on function public.${rpc}`),
  );
}
check("friend RPC uses advisory lock", sql.includes("pg_advisory_xact_lock"));
check("friend RPC verifies both room members", sql.includes("TARGET_NOT_IN_ROOM") && sql.includes("NOT_A_MEMBER"));
check("owner RPC requires room owner", sql.includes("NOT_ROOM_OWNER"));
check("owner end marks room ended", sql.includes("cleanup_reason = 'owner_ended_v4a'"));
check("owner removal revokes membership", sql.includes("delete from public.room_members"));
check("migration has lock timeout", sql.includes("set local lock_timeout = '15s'"));

includes("lib/releaseInfo.ts", [
  "calmco-p4a-rooms-operational-ux-v140-2026-07-24",
  "P4A_BUILD_TAGS",
  "daily_user_id_from_authenticated_user: true",
  "social_actions_room_scoped: true",
]);

includes("package.json", ["verify:p4a-contracts", "verify:p4a-production"]);

const summary = {
  ok: failures.length === 0,
  passed: checks.length - failures.length,
  failed: failures.length,
  total: checks.length,
  failures,
};
console.log(JSON.stringify(summary, null, 2));
if (failures.length) process.exit(1);
