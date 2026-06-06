import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit } from "@/lib/server/adminAuth";

export const runtime = "nodejs";
type Context = { params: Promise<{ notificationId: string }> };
const ALLOWED = new Set(["queued", "sent", "manual_required", "failed", "cancelled", "dismissed"]);

export async function PATCH(req: Request, context: Context) {
  try {
    const admin = await getAdminUserFromRequest(req);
    const { notificationId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const statusValue = String(body.status || "").trim();
    if (!ALLOWED.has(statusValue)) return NextResponse.json({ error: "無效的通知狀態。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });

    const now = new Date().toISOString();
    const patch: Record<string, any> = { status: statusValue, updated_at: now };
    if (statusValue === "queued") {
      patch.next_attempt_at = now;
      patch.last_error = null;
    }
    if (statusValue === "sent") patch.sent_at = now;
    if (statusValue === "dismissed") patch.dismissed_at = now;
    if (body.last_error !== undefined) patch.last_error = String(body.last_error || "").slice(0, 2000) || null;

    const { data, error } = await supabaseAdmin.from("notification_outbox").update(patch).eq("id", notificationId).select("*").single();
    if (error || !data) return NextResponse.json({ error: error?.message || "更新通知失敗。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });

    await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "admin_notification_updated", targetType: "notification_outbox", targetId: notificationId, metadata: { status: statusValue } });
    return NextResponse.json({ notification: data, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}
