import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit } from "@/lib/server/adminAuth";

export const runtime = "nodejs";
type Context = { params: Promise<{ actionId: string }> };
const ALLOWED_STATUS = new Set(["open", "in_progress", "waiting", "resolved", "dismissed", "cancelled"]);

export async function PATCH(req: Request, context: Context) {
  try {
    const admin = await getAdminUserFromRequest(req);
    const { actionId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };

    if (body.status !== undefined) {
      const statusValue = String(body.status || "").trim();
      if (!ALLOWED_STATUS.has(statusValue)) return NextResponse.json({ error: "無效的任務狀態。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
      patch.status = statusValue;
      if (["resolved", "dismissed", "cancelled"].includes(statusValue)) {
        patch.resolved_at = new Date().toISOString();
        patch.resolved_by_admin_user_id = admin.userId;
      }
    }
    if (body.assigned_admin_user_id !== undefined) patch.assigned_admin_user_id = body.assigned_admin_user_id || null;
    if (body.resolution_note !== undefined) patch.resolution_note = String(body.resolution_note || "").slice(0, 3000) || null;
    if (body.due_at !== undefined) patch.due_at = body.due_at || null;

    const { data, error } = await supabaseAdmin.from("ops_action_items").update(patch).eq("id", actionId).select("*").single();
    if (error || !data) return NextResponse.json({ error: error?.message || "更新任務失敗。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });

    await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "admin_action_item_updated", targetType: "ops_action_item", targetId: actionId, metadata: { status: patch.status || null } });
    return NextResponse.json({ action_item: data, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}
