import { NextResponse } from "next/server";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit } from "@/lib/server/adminAuth";
import { ROOM_RECONCILIATION_BUILD_TAG, deleteDailyRoomByName, endSupabaseRoom, markReconciliationItem } from "@/lib/server/roomReconciliation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
type Context = { params: Promise<{ itemId: string }> };
type Body = { action?: "mark_in_progress" | "ignore" | "mark_fixed" | "end_room" | "delete_daily_room" | "end_room_and_delete_daily"; note?: string };

export async function PATCH(req: Request, context: Context) {
  try {
    const admin = await getAdminUserFromRequest(req, { permission: "rooms.manage" });
    const { itemId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as Body;
    const action = body.action || "mark_in_progress";
    const itemResult = await supabaseAdmin.from("room_reconciliation_items").select("*").eq("id", itemId).maybeSingle();
    if (itemResult.error || !itemResult.data) return NextResponse.json({ error: itemResult.error?.message || "找不到 reconciliation item。", build_tag: ROOM_RECONCILIATION_BUILD_TAG }, { status: 404 });
    const item = itemResult.data as any;
    let actionResult: Record<string, unknown> = { action, note: body.note || null };
    if (action === "mark_in_progress") {
      const updated = await markReconciliationItem({ itemId, adminUserId: admin.userId, status: "in_progress", result: actionResult });
      await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "room_reconciliation_item_in_progress", targetType: "room_reconciliation_item", targetId: itemId });
      return NextResponse.json({ item: updated, build_tag: ROOM_RECONCILIATION_BUILD_TAG });
    }
    if (action === "ignore") {
      const updated = await markReconciliationItem({ itemId, adminUserId: admin.userId, status: "ignored", result: actionResult });
      await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "room_reconciliation_item_ignored", targetType: "room_reconciliation_item", targetId: itemId });
      return NextResponse.json({ item: updated, build_tag: ROOM_RECONCILIATION_BUILD_TAG });
    }
    if (action === "mark_fixed") {
      const updated = await markReconciliationItem({ itemId, adminUserId: admin.userId, status: "fixed", result: actionResult });
      await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "room_reconciliation_item_marked_fixed", targetType: "room_reconciliation_item", targetId: itemId });
      return NextResponse.json({ item: updated, build_tag: ROOM_RECONCILIATION_BUILD_TAG });
    }
    if (action === "end_room" || action === "end_room_and_delete_daily") {
      if (!item.room_id) return NextResponse.json({ error: "此 item 沒有 room_id。", build_tag: ROOM_RECONCILIATION_BUILD_TAG }, { status: 400 });
      const room = await endSupabaseRoom(item.room_id, admin.userId, `room_reconciliation_item:${itemId}`);
      actionResult = { ...actionResult, room };
      if (action === "end_room_and_delete_daily" && item.daily_room_name) actionResult.daily_result = await deleteDailyRoomByName(item.daily_room_name);
      const updated = await markReconciliationItem({ itemId, adminUserId: admin.userId, status: "fixed", result: actionResult });
      await writeAdminAudit(req, { adminUserId: admin.userId, actionType: `room_reconciliation_item_${action}`, targetType: "room_reconciliation_item", targetId: itemId, metadata: actionResult });
      return NextResponse.json({ item: updated, result: actionResult, build_tag: ROOM_RECONCILIATION_BUILD_TAG });
    }
    if (action === "delete_daily_room") {
      if (!item.daily_room_name) return NextResponse.json({ error: "此 item 沒有 daily_room_name。", build_tag: ROOM_RECONCILIATION_BUILD_TAG }, { status: 400 });
      actionResult.daily_result = await deleteDailyRoomByName(item.daily_room_name);
      const updated = await markReconciliationItem({ itemId, adminUserId: admin.userId, status: "fixed", result: actionResult });
      await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "room_reconciliation_item_delete_daily_room", targetType: "room_reconciliation_item", targetId: itemId, metadata: actionResult });
      return NextResponse.json({ item: updated, result: actionResult, build_tag: ROOM_RECONCILIATION_BUILD_TAG });
    }
    return NextResponse.json({ error: "不支援的 action。", build_tag: ROOM_RECONCILIATION_BUILD_TAG }, { status: 400 });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}
