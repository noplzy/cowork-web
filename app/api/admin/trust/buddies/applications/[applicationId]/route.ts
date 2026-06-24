import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit } from "@/lib/server/adminAuth";

export const runtime = "nodejs";
type Context = { params: Promise<{ applicationId: string }> };
type PatchBody = { action?: "approve" | "needs_more_info" | "reject" | "suspend"; reviewer_note?: string | null };

function mapActionToStatus(action: PatchBody["action"]) {
  if (action === "approve") return "approved";
  if (action === "needs_more_info") return "needs_more_info";
  if (action === "reject") return "rejected";
  if (action === "suspend") return "suspended";
  return null;
}

async function hasApprovedIdentity(userId: string) {
  const result = await supabaseAdmin
    .from("identity_verification_requests")
    .select("id")
    .eq("user_id", userId)
    .eq("review_status", "approved")
    .limit(1);
  if (result.error) throw result.error;
  return (result.data ?? []).length > 0;
}

export async function PATCH(req: Request, context: Context) {
  try {
    const admin = await getAdminUserFromRequest(req, { permission: "buddies.review" });
    const { applicationId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as PatchBody;
    const nextStatus = mapActionToStatus(body.action);
    const reviewerNote = String(body.reviewer_note || "").trim().slice(0, 3000) || null;

    if (!nextStatus) {
      return NextResponse.json({ error: "無效的安感夥伴審核動作。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    }

    if ((nextStatus === "rejected" || nextStatus === "needs_more_info" || nextStatus === "suspended") && !reviewerNote) {
      return NextResponse.json({ error: "退回、拒絕或停權時必須填寫審核說明。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    }

    const existing = await supabaseAdmin
      .from("buddy_provider_applications")
      .select("*")
      .eq("id", applicationId)
      .maybeSingle();

    if (existing.error || !existing.data) {
      return NextResponse.json({ error: existing.error?.message || "找不到安感夥伴申請。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 404 });
    }

    if (nextStatus === "approved" && !(await hasApprovedIdentity(existing.data.user_id))) {
      return NextResponse.json({ error: "此使用者尚未通過身分人工審核，不能核准成為專業安感夥伴。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    }

    const now = new Date().toISOString();
    const updated = await supabaseAdmin
      .from("buddy_provider_applications")
      .update({
        application_status: nextStatus,
        reviewer_user_id: admin.userId,
        reviewer_note: reviewerNote,
        reviewed_at: now,
        updated_at: now,
        metadata: { ...(existing.data.metadata || {}), last_admin_action: body.action, last_admin_user_id: admin.userId },
      })
      .eq("id", applicationId)
      .select("*")
      .single();

    if (updated.error || !updated.data) {
      return NextResponse.json({ error: updated.error?.message || "更新安感夥伴申請失敗。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    }

    if (nextStatus === "approved") {
      await supabaseAdmin
        .from("profiles")
        .update({ is_professional_buddy: true, updated_at: now })
        .eq("user_id", updated.data.user_id);
    }

    if (nextStatus === "suspended") {
      await Promise.all([
        supabaseAdmin.from("profiles").update({ is_professional_buddy: false, updated_at: now }).eq("user_id", updated.data.user_id),
        supabaseAdmin.from("buddy_services").update({ status: "paused", updated_at: now }).eq("provider_user_id", updated.data.user_id).eq("status", "active"),
      ]);
    }

    await writeAdminAudit(req, {
      adminUserId: admin.userId,
      actionType: "admin_buddy_provider_application_reviewed",
      targetType: "buddy_provider_application",
      targetId: applicationId,
      metadata: {
        before_status: existing.data.application_status,
        after_status: nextStatus,
        target_user_id: updated.data.user_id,
      },
    });

    return NextResponse.json({ application: updated.data, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}
