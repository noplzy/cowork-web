import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit } from "@/lib/server/adminAuth";

export const runtime = "nodejs";
type Context = { params: Promise<{ disputeId: string }> };
type PatchBody = { action?: "review" | "resolve" | "reject" | "cancel"; admin_note?: string | null };

function mapActionToStatus(action: PatchBody["action"]) {
  if (action === "review") return "reviewing";
  if (action === "resolve") return "resolved";
  if (action === "reject") return "rejected";
  if (action === "cancel") return "cancelled";
  return null;
}

export async function PATCH(req: Request, context: Context) {
  try {
    const admin = await getAdminUserFromRequest(req, { permission: "buddies.disputes" });
    const { disputeId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as PatchBody;
    const nextStatus = mapActionToStatus(body.action);
    const adminNote = String(body.admin_note || "").trim().slice(0, 3000) || null;

    if (!nextStatus) {
      return NextResponse.json({ error: "無效的 Buddies 爭議處理動作。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    }

    if (["resolved", "rejected", "cancelled"].includes(nextStatus) && !adminNote) {
      return NextResponse.json({ error: "結案、駁回或取消時必須填寫處理說明。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    }

    const existing = await supabaseAdmin
      .from("buddy_disputes")
      .select("*")
      .eq("id", disputeId)
      .maybeSingle();

    if (existing.error || !existing.data) {
      return NextResponse.json({ error: existing.error?.message || "找不到 Buddies 爭議案件。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 404 });
    }

    const now = new Date().toISOString();
    const closed = ["resolved", "rejected", "cancelled"].includes(nextStatus);

    const updated = await supabaseAdmin
      .from("buddy_disputes")
      .update({
        dispute_status: nextStatus,
        admin_user_id: admin.userId,
        admin_note: adminNote,
        resolved_at: closed ? now : existing.data.resolved_at,
        updated_at: now,
        metadata: { ...(existing.data.metadata || {}), last_admin_action: body.action, last_admin_user_id: admin.userId },
      })
      .eq("id", disputeId)
      .select("*")
      .single();

    if (updated.error || !updated.data) {
      return NextResponse.json({ error: updated.error?.message || "更新 Buddies 爭議失敗。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    }

    if (updated.data.booking_id) {
      await Promise.all([
        supabaseAdmin
          .from("buddy_bookings")
          .update({ dispute_status: nextStatus, updated_at: now })
          .eq("id", updated.data.booking_id),
        supabaseAdmin
          .from("buddy_booking_events")
          .insert({
            booking_id: updated.data.booking_id,
            actor_user_id: admin.userId,
            event_type: `admin_dispute_${nextStatus}`,
            metadata: { dispute_id: disputeId, admin_note: adminNote },
          }),
      ]);
    }

    await writeAdminAudit(req, {
      adminUserId: admin.userId,
      actionType: "admin_buddy_dispute_reviewed",
      targetType: "buddy_dispute",
      targetId: disputeId,
      metadata: {
        before_status: existing.data.dispute_status,
        after_status: nextStatus,
        booking_id: updated.data.booking_id,
      },
    });

    return NextResponse.json({ dispute: updated.data, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}
