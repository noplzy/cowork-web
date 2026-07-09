import { NextResponse } from "next/server";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit } from "@/lib/server/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ROOM_RECONCILIATION_BUILD_TAG, deleteDailyRoomByName, endSupabaseRoom, persistRoomReconciliationRun, scanRoomReconciliation } from "@/lib/server/roomReconciliation";

export const runtime = "nodejs";

type Body = { action?: "scan" | "end_room" | "delete_daily_room" | "end_room_and_delete_daily"; room_id?: string; daily_room_name?: string; reason?: string; persist?: boolean };

export async function GET(req: Request) {
  try {
    const admin = await getAdminUserFromRequest(req, { permission: "rooms.manage" });
    const url = new URL(req.url);
    const persist = url.searchParams.get("persist") === "1";
    const limit = Math.min(Math.max(Number(url.searchParams.get("history_limit") || 40), 1), 100);
    const [scan, runs, openItems] = await Promise.all([
      scanRoomReconciliation(),
      supabaseAdmin.from("room_reconciliation_runs").select("*").order("created_at", { ascending: false }).limit(limit),
      supabaseAdmin.from("room_reconciliation_items").select("*").in("status", ["open", "in_progress", "failed"]).order("created_at", { ascending: false }).limit(200),
    ]);
    const persisted = persist ? await persistRoomReconciliationRun({ adminUserId: admin.userId, runType: "manual_scan", scan }) : null;
    await writeAdminAudit(req, { adminUserId: admin.userId, actionType: persist ? "room_reconciliation_scanned_and_persisted" : "room_reconciliation_scanned", targetType: "room_reconciliation", metadata: { summary: scan.summary, persist } });
    return NextResponse.json({ ...scan, runs: runs.error ? [] : runs.data ?? [], open_items: openItems.error ? [] : openItems.data ?? [], errors: [runs.error?.message, openItems.error?.message, scan.daily_error].filter(Boolean), persisted, build_tag: ROOM_RECONCILIATION_BUILD_TAG, admin_build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminUserFromRequest(req, { permission: "rooms.manage" });
    const body = (await req.json().catch(() => ({}))) as Body;
    const action = body.action || "scan";
    if (action === "scan") {
      const scan = await scanRoomReconciliation();
      const persisted = body.persist === false ? null : await persistRoomReconciliationRun({ adminUserId: admin.userId, runType: "manual_scan", scan });
      await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "room_reconciliation_scan_created", targetType: "room_reconciliation", targetId: persisted?.run?.id ?? null, metadata: { summary: scan.summary } });
      return NextResponse.json({ ...scan, persisted, build_tag: ROOM_RECONCILIATION_BUILD_TAG });
    }
    if (action === "end_room") {
      const roomId = String(body.room_id || "").trim();
      if (!roomId) return NextResponse.json({ error: "缺少 room_id。", build_tag: ROOM_RECONCILIATION_BUILD_TAG }, { status: 400 });
      const room = await endSupabaseRoom(roomId, admin.userId, body.reason || "admin_reconciliation_end_room");
      await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "room_reconciliation_end_room", targetType: "room", targetId: roomId, metadata: { reason: body.reason || null } });
      return NextResponse.json({ room, build_tag: ROOM_RECONCILIATION_BUILD_TAG });
    }
    if (action === "delete_daily_room") {
      const roomName = String(body.daily_room_name || "").trim();
      if (!roomName) return NextResponse.json({ error: "缺少 daily_room_name。", build_tag: ROOM_RECONCILIATION_BUILD_TAG }, { status: 400 });
      const result = await deleteDailyRoomByName(roomName);
      await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "room_reconciliation_delete_daily_room", targetType: "daily_room", targetId: roomName, metadata: { result } });
      return NextResponse.json({ daily_room_name: roomName, result, build_tag: ROOM_RECONCILIATION_BUILD_TAG });
    }
    if (action === "end_room_and_delete_daily") {
      const roomId = String(body.room_id || "").trim();
      const roomName = String(body.daily_room_name || "").trim();
      if (!roomId) return NextResponse.json({ error: "缺少 room_id。", build_tag: ROOM_RECONCILIATION_BUILD_TAG }, { status: 400 });
      const room = await endSupabaseRoom(roomId, admin.userId, body.reason || "admin_reconciliation_end_room_and_delete_daily");
      const dailyResult = roomName ? await deleteDailyRoomByName(roomName) : { ok: false, skipped: true, reason: "missing_daily_room_name" };
      await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "room_reconciliation_end_room_and_delete_daily", targetType: "room", targetId: roomId, metadata: { daily_room_name: roomName, daily_result: dailyResult } });
      return NextResponse.json({ room, daily_room_name: roomName, daily_result: dailyResult, build_tag: ROOM_RECONCILIATION_BUILD_TAG });
    }
    return NextResponse.json({ error: "不支援的 action。", build_tag: ROOM_RECONCILIATION_BUILD_TAG }, { status: 400 });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}
