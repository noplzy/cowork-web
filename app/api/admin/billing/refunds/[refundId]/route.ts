import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit } from "@/lib/server/adminAuth";
import { cleanText } from "@/lib/server/safety";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ refundId: string }> };
type PatchBody = {
  status?: "reviewing" | "approved" | "rejected" | "processing" | "refunded" | "failed" | "cancelled";
  admin_note?: string;
  provider_refund_id?: string | null;
};

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const admin = await getAdminUserFromRequest(req);
    const { refundId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as PatchBody;

    const current = await supabaseAdmin.from("refund_requests").select("*").eq("id", refundId).maybeSingle();
    if (current.error || !current.data) {
      return NextResponse.json({ error: current.error?.message || "找不到退款申請。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 404 });
    }

    if (!body.status) {
      return NextResponse.json({ error: "缺少退款狀態。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const patch: Record<string, any> = {
      status: body.status,
      admin_note: cleanText(body.admin_note, 6000) || null,
      reviewed_by_admin_user_id: admin.userId,
      reviewed_at: current.data.reviewed_at || nowIso,
      updated_at: nowIso,
    };

    if (["refunded", "rejected", "failed", "cancelled"].includes(body.status)) patch.resolved_at = nowIso;
    if (body.provider_refund_id) patch.provider_refund_id = cleanText(body.provider_refund_id, 120);

    const updated = await supabaseAdmin.from("refund_requests").update(patch).eq("id", refundId).select("*").single();
    if (updated.error || !updated.data) {
      return NextResponse.json({ error: updated.error?.message || "更新退款申請失敗。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    }

    await supabaseAdmin.from("refund_events").insert({
      refund_request_id: refundId,
      actor_user_id: admin.userId,
      actor_role: "admin",
      event_type: `refund_${body.status}`,
      metadata: { from_status: current.data.status, to_status: updated.data.status, admin_note: patch.admin_note, provider_refund_id: patch.provider_refund_id || null },
    });

    if (updated.data.support_ticket_id && ["refunded", "rejected", "failed", "cancelled"].includes(updated.data.status)) {
      await supabaseAdmin.from("support_tickets").update({
        status: updated.data.status === "refunded" ? "resolved" : "admin_review",
        updated_at: nowIso,
        admin_note: patch.admin_note,
      }).eq("id", updated.data.support_ticket_id);
    }

    await writeAdminAudit(req, {
      adminUserId: admin.userId,
      actionType: "admin_refund_request_updated",
      targetType: "refund_request",
      targetId: refundId,
      metadata: { from_status: current.data.status, to_status: updated.data.status },
    });

    return NextResponse.json({ refund: updated.data, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}
