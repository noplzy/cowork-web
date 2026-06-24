import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit } from "@/lib/server/adminAuth";

export const runtime = "nodejs";
type Context = { params: Promise<{ requestId: string }> };
type PatchBody = { action?: "approve" | "needs_more_info" | "reject" | "cancel"; reviewer_note?: string | null };

function mapActionToStatus(action: PatchBody["action"]) {
  if (action === "approve") return "approved";
  if (action === "needs_more_info") return "needs_more_info";
  if (action === "reject") return "rejected";
  if (action === "cancel") return "cancelled";
  return null;
}

async function updateManualReviewBinding(input: { requestId: string; userId: string; status: string; documentLast4?: string | null }) {
  const now = new Date().toISOString();
  const bindingValue = input.documentLast4 ? `document-***${input.documentLast4}` : `manual-review-${input.requestId}`;
  const bindingStatus = input.status === "approved" ? "verified" : input.status === "needs_more_info" ? "pending" : "rejected";

  const existing = await supabaseAdmin
    .from("user_identity_bindings")
    .select("id")
    .eq("user_id", input.userId)
    .eq("binding_type", "manual_review")
    .contains("metadata", { identity_request_id: input.requestId })
    .maybeSingle();

  if (existing.error) throw existing.error;

  const payload = {
    user_id: input.userId,
    binding_type: "manual_review",
    binding_value_masked: bindingValue,
    status: bindingStatus,
    verified_at: input.status === "approved" ? now : null,
    source: "admin_review",
    metadata: { identity_request_id: input.requestId },
    updated_at: now,
  };

  if (existing.data?.id) {
    const updated = await supabaseAdmin.from("user_identity_bindings").update(payload).eq("id", existing.data.id);
    if (updated.error) throw updated.error;
  } else {
    const inserted = await supabaseAdmin.from("user_identity_bindings").insert(payload);
    if (inserted.error) throw inserted.error;
  }
}

export async function PATCH(req: Request, context: Context) {
  try {
    const admin = await getAdminUserFromRequest(req, { permission: "identity.review" });
    const { requestId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as PatchBody;
    const nextStatus = mapActionToStatus(body.action);
    const reviewerNote = String(body.reviewer_note || "").trim().slice(0, 3000) || null;

    if (!nextStatus) {
      return NextResponse.json({ error: "無效的身份審核動作。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    }

    if ((nextStatus === "rejected" || nextStatus === "needs_more_info") && !reviewerNote) {
      return NextResponse.json({ error: "退回或拒絕時必須填寫審核說明。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    }

    const existing = await supabaseAdmin
      .from("identity_verification_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (existing.error || !existing.data) {
      return NextResponse.json({ error: existing.error?.message || "找不到身份審核申請。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 404 });
    }

    const now = new Date().toISOString();
    const updated = await supabaseAdmin
      .from("identity_verification_requests")
      .update({
        review_status: nextStatus,
        reviewer_user_id: admin.userId,
        reviewer_note: reviewerNote,
        reviewed_at: now,
        updated_at: now,
        metadata: { ...(existing.data.metadata || {}), last_admin_action: body.action, last_admin_user_id: admin.userId },
      })
      .eq("id", requestId)
      .select("*")
      .single();

    if (updated.error || !updated.data) {
      return NextResponse.json({ error: updated.error?.message || "更新身份審核失敗。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    }

    await updateManualReviewBinding({
      requestId,
      userId: updated.data.user_id,
      status: nextStatus,
      documentLast4: updated.data.document_last4,
    });

    await writeAdminAudit(req, {
      adminUserId: admin.userId,
      actionType: "admin_identity_request_reviewed",
      targetType: "identity_verification_request",
      targetId: requestId,
      metadata: {
        before_status: existing.data.review_status,
        after_status: nextStatus,
        target_user_id: updated.data.user_id,
      },
    });

    return NextResponse.json({ request: updated.data, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}
