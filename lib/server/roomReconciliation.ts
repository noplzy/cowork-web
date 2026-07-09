import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { listManagedDailyRooms, parseDailyRoomNameFromUrl, tryDeleteDailyRoom, ROOM_INFRA_BUILD_TAG } from "@/lib/server/roomInfra";

export const ROOM_RECONCILIATION_BUILD_TAG = "daily-room-reconciliation-v117-2026-06-25";

type Severity = "low" | "normal" | "high" | "urgent" | "critical";
type IssueType = "active_overdue" | "active_without_daily_url" | "active_daily_missing" | "ended_with_daily_room" | "orphan_daily_room" | "active_without_members" | "stale_presence" | "daily_list_failed";

export type RoomReconciliationItemDraft = {
  issue_type: IssueType;
  severity: Severity;
  room_id?: string | null;
  daily_room_name?: string | null;
  daily_room_url?: string | null;
  title: string;
  description?: string | null;
  recommended_action?: string | null;
  metadata?: Record<string, unknown>;
};

type RoomRow = {
  id: string;
  title?: string | null;
  status?: string | null;
  daily_room_url?: string | null;
  created_at?: string | null;
  started_at?: string | null;
  scheduled_end_at?: string | null;
  ended_at?: string | null;
  last_presence_at?: string | null;
  duration_minutes?: number | null;
  created_by?: string | null;
};

function parseMs(value?: string | null) {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

function isBeforeNow(value?: string | null, graceMinutes = 0) {
  const t = parseMs(value);
  if (!t) return false;
  return t + graceMinutes * 60_000 < Date.now();
}

function scheduledEnd(room: RoomRow) {
  if (room.scheduled_end_at) return room.scheduled_end_at;
  const base = parseMs(room.started_at || room.created_at);
  if (!base) return null;
  const duration = Number(room.duration_minutes || 25);
  return new Date(base + (Number.isFinite(duration) ? duration : 25) * 60_000).toISOString();
}

function roomNameFor(room: RoomRow) {
  return parseDailyRoomNameFromUrl(room.daily_room_url);
}

function item(input: RoomReconciliationItemDraft): RoomReconciliationItemDraft {
  return { description: null, recommended_action: null, metadata: {}, ...input };
}

function summarize(items: RoomReconciliationItemDraft[]) {
  return items.reduce((acc: Record<string, number>, row) => {
    acc.total = (acc.total || 0) + 1;
    acc[row.issue_type] = (acc[row.issue_type] || 0) + 1;
    acc[`severity_${row.severity}`] = (acc[`severity_${row.severity}`] || 0) + 1;
    return acc;
  }, {});
}

export async function scanRoomReconciliation() {
  const [roomsResult, membersResult, dailyRoomsResult] = await Promise.all([
    supabaseAdmin.from("rooms").select("id,title,status,daily_room_url,created_at,started_at,scheduled_end_at,ended_at,last_presence_at,duration_minutes,created_by").order("created_at", { ascending: false }).limit(600),
    supabaseAdmin.from("room_members").select("room_id,user_id").limit(2000),
    listManagedDailyRooms(100),
  ]);

  if (roomsResult.error) throw roomsResult.error;
  if (membersResult.error) throw membersResult.error;

  const rooms = (roomsResult.data ?? []) as RoomRow[];
  const membersByRoom = new Map<string, number>();
  for (const row of membersResult.data ?? []) {
    const roomId = String((row as any).room_id || "");
    if (roomId) membersByRoom.set(roomId, (membersByRoom.get(roomId) || 0) + 1);
  }

  const dailyRooms = dailyRoomsResult.ok ? dailyRoomsResult.rooms : [];
  const dailyByName = new Map<string, any>();
  for (const dailyRoom of dailyRooms) if (dailyRoom.name) dailyByName.set(dailyRoom.name, dailyRoom);

  const activeDailyNames = new Set<string>();
  const referencedDailyNames = new Set<string>();
  const issues: RoomReconciliationItemDraft[] = [];

  for (const room of rooms) {
    const roomName = roomNameFor(room);
    if (roomName) referencedDailyNames.add(roomName);
    const status = room.status || "active";
    const isActive = status === "active";
    const isEnded = status === "ended" || status === "expired" || Boolean(room.ended_at);
    const endAt = scheduledEnd(room);
    const memberCount = membersByRoom.get(room.id) || 0;
    if (isActive && roomName) activeDailyNames.add(roomName);

    if (isActive && isBeforeNow(endAt, 5)) {
      issues.push(item({ issue_type: "active_overdue", severity: "high", room_id: room.id, daily_room_name: roomName, daily_room_url: room.daily_room_url, title: `逾期仍 active：${room.title || room.id}`, description: `scheduled_end_at=${endAt || "missing"}，status 仍為 active。`, recommended_action: "run_cleanup_or_end_room", metadata: { scheduled_end_at: endAt, status, created_by: room.created_by } }));
    }
    if (isActive && !room.daily_room_url) {
      issues.push(item({ issue_type: "active_without_daily_url", severity: "urgent", room_id: room.id, title: `active 房間缺少 Daily URL：${room.title || room.id}`, description: "Supabase rooms.status=active，但 daily_room_url 為空，使用者可能看得到房間卻無法進入通話。", recommended_action: "end_room_or_recreate_daily", metadata: { status, created_by: room.created_by } }));
    }
    if (isActive && roomName && dailyRoomsResult.ok && !dailyByName.has(roomName)) {
      issues.push(item({ issue_type: "active_daily_missing", severity: "critical", room_id: room.id, daily_room_name: roomName, daily_room_url: room.daily_room_url, title: `active 房間的 Daily room 不存在：${room.title || room.id}`, description: `Daily room ${roomName} 不在 Daily API list 結果中。`, recommended_action: "end_room_or_recreate_daily", metadata: { status, created_by: room.created_by } }));
    }
    if (isEnded && roomName && dailyRoomsResult.ok && dailyByName.has(roomName)) {
      issues.push(item({ issue_type: "ended_with_daily_room", severity: "normal", room_id: room.id, daily_room_name: roomName, daily_room_url: room.daily_room_url, title: `已結束房間仍有 Daily room：${room.title || room.id}`, description: `Supabase 已 ended / expired，但 Daily room ${roomName} 仍存在。`, recommended_action: "delete_daily_room", metadata: { status, ended_at: room.ended_at } }));
    }
    if (isActive && memberCount <= 0) {
      issues.push(item({ issue_type: "active_without_members", severity: "high", room_id: room.id, daily_room_name: roomName, daily_room_url: room.daily_room_url, title: `active 房間沒有 room_members：${room.title || room.id}`, description: "房間為 active，但沒有任何 room_members。這通常代表建立 / join 流程中斷。", recommended_action: "end_room", metadata: { member_count: memberCount, status } }));
    }
    if (isActive && room.last_presence_at && isBeforeNow(room.last_presence_at, 30) && !isBeforeNow(endAt, 5)) {
      issues.push(item({ issue_type: "stale_presence", severity: "low", room_id: room.id, daily_room_name: roomName, daily_room_url: room.daily_room_url, title: `presence 過久未更新：${room.title || room.id}`, description: `last_presence_at=${room.last_presence_at}`, recommended_action: "observe_or_end_if_empty", metadata: { last_presence_at: room.last_presence_at, scheduled_end_at: endAt } }));
    }
  }

  if (dailyRoomsResult.ok) {
    for (const dailyRoom of dailyRooms) {
      const roomName = dailyRoom.name || "";
      if (!roomName || activeDailyNames.has(roomName)) continue;
      const matchingRoom = rooms.find((room) => roomNameFor(room) === roomName);
      if (matchingRoom && (matchingRoom.status === "ended" || matchingRoom.status === "expired" || matchingRoom.ended_at)) continue;
      issues.push(item({ issue_type: "orphan_daily_room", severity: "high", daily_room_name: roomName, daily_room_url: dailyRoom.url || null, title: `Daily orphan room：${roomName}`, description: "Daily 有 cowork_ / buddy_ 管理房，但沒有對應 active Supabase room。", recommended_action: "delete_daily_room", metadata: { daily_room: dailyRoom, has_supabase_reference: referencedDailyNames.has(roomName) } }));
    }
  } else {
    issues.push(item({ issue_type: "daily_list_failed", severity: "urgent", title: "Daily rooms list 失敗", description: dailyRoomsResult.error || "Daily list failed", recommended_action: "check_daily_api_key", metadata: { error: dailyRoomsResult.error || null } }));
  }

  return { rooms, daily_rooms: dailyRooms, daily_error: dailyRoomsResult.ok ? null : dailyRoomsResult.error || "daily_list_failed", issues, summary: summarize(issues), scanned_supabase_rooms: rooms.length, scanned_daily_rooms: dailyRooms.length, build_tag: ROOM_RECONCILIATION_BUILD_TAG, room_infra_build_tag: ROOM_INFRA_BUILD_TAG };
}

export async function persistRoomReconciliationRun(input: { adminUserId?: string | null; runType?: "manual_scan" | "manual_fix" | "cleanup_cron" | "auto_scan"; scan: Awaited<ReturnType<typeof scanRoomReconciliation>> }) {
  const run = await supabaseAdmin.from("room_reconciliation_runs").insert({ run_type: input.runType || "manual_scan", status: "completed", scanned_supabase_rooms: input.scan.scanned_supabase_rooms, scanned_daily_rooms: input.scan.scanned_daily_rooms, detected_items: input.scan.issues.length, triggered_by_admin_user_id: input.adminUserId ?? null, summary: input.scan.summary, completed_at: new Date().toISOString() }).select("*").single();
  if (run.error || !run.data) throw run.error || new Error("failed_to_create_reconciliation_run");
  if (input.scan.issues.length) {
    const rows = input.scan.issues.map((issue) => ({ ...issue, run_id: run.data.id, status: "open", metadata: issue.metadata ?? {} }));
    const inserted = await supabaseAdmin.from("room_reconciliation_items").insert(rows).select("*");
    if (inserted.error) throw inserted.error;
    return { run: run.data, items: inserted.data ?? [] };
  }
  return { run: run.data, items: [] };
}

export async function endSupabaseRoom(roomId: string, adminUserId: string, reason = "admin_reconciliation") {
  const now = new Date().toISOString();
  const room = await supabaseAdmin.from("rooms").update({ status: "ended", ended_at: now, cleanup_reason: reason }).eq("id", roomId).select("id,title,status,daily_room_url").single();
  if (room.error || !room.data) throw room.error || new Error("failed_to_end_room");
  await supabaseAdmin.from("room_access_sessions").update({ status: "ended", updated_at: now }).eq("room_id", roomId).eq("status", "active");
  await supabaseAdmin.from("reliability_events").insert({ user_id: adminUserId, room_id: roomId, event_type: "admin_reconciliation_room_ended", severity: "high", source: "admin_room_reconciliation_v117", metadata: { reason } }).then(() => null);
  return room.data;
}

export async function deleteDailyRoomByName(roomName: string) {
  if (!roomName) throw new Error("Missing Daily room name.");
  return tryDeleteDailyRoom(roomName);
}

export async function markReconciliationItem(input: { itemId: string; adminUserId: string; status: "fixed" | "ignored" | "failed" | "in_progress"; result?: Record<string, unknown> }) {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: input.status, updated_at: now };
  if (input.status === "fixed" || input.status === "failed") { patch.fixed_by_admin_user_id = input.adminUserId; patch.fixed_at = now; patch.fix_result = input.result ?? {}; }
  if (input.status === "ignored") { patch.ignored_by_admin_user_id = input.adminUserId; patch.ignored_at = now; patch.fix_result = input.result ?? {}; }
  const updated = await supabaseAdmin.from("room_reconciliation_items").update(patch).eq("id", input.itemId).select("*").single();
  if (updated.error || !updated.data) throw updated.error || new Error("failed_to_update_reconciliation_item");
  return updated.data;
}
