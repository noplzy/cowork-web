import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit } from "@/lib/server/adminAuth";

export const runtime = "nodejs";

type Context = { params: Promise<{ taskId: string }> };

const ALLOWED = new Set(["queued", "processing", "issued", "completed", "voided", "allowance_issued", "manual_required", "failed", "cancelled"]);

export async function PATCH(req: Request, context: Context) {
  try {
    const admin = await getAdminUserFromRequest(req);
    const { taskId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const statusValue = String(body.status || "").trim();

    if (!ALLOWED.has(statusValue)) {
      return NextResponse.json({ error: "無效的狀態。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    }

    const patch: Record<string, any> = { status: statusValue, updated_at: new Date().toISOString() };
    if (body.last_error !== undefined) patch.last_error = String(body.last_error || "").slice(0, 2000) || null;
    if (body.provider_payload !== undefined) patch.provider_payload = body.provider_payload || {};
    if (body.provider_invoice_no !== undefined) patch.provider_invoice_no = String(body.provider_invoice_no || "").slice(0, 80) || null;
    if (body.provider_random_number !== undefined) patch.provider_random_number = String(body.provider_random_number || "").slice(0, 20) || null;
    if (body.action_type !== undefined) patch.action_type = String(body.action_type || "").slice(0, 80) || "issue";
    if (["issued", "completed", "voided", "allowance_issued"].includes(statusValue)) patch.processed_at = new Date().toISOString();

    const updated = await supabaseAdmin.from("ecpay_invoice_tasks").update(patch).eq("id", taskId).select("*").single();
    if (updated.error || !updated.data) {
      return NextResponse.json({ error: updated.error?.message || "更新任務失敗。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    }

    await writeAdminAudit(req, {
      adminUserId: admin.userId,
      actionType: "admin_invoice_task_updated",
      targetType: "ecpay_invoice_tasks",
      targetId: taskId,
      metadata: { status: statusValue, action_type: updated.data.action_type || null },
    });

    return NextResponse.json({ task: updated.data, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}
