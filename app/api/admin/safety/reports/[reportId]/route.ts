import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  ADMIN_OPS_BUILD_TAG,
  adminErrorResponse,
  getAdminUserFromRequest,
  writeAdminAudit,
} from "@/lib/server/adminAuth";
import { cleanText } from "@/lib/server/safety";
import { assertReportTransition } from "@/lib/server/trustOps";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ reportId: string }> };
type PatchBody = { status?: "open" | "triaged" | "actioned" | "dismissed" | "closed"; admin_note?: string; create_case?: boolean };

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const admin = await getAdminUserFromRequest(req, { permission: "safety.manage" });
    const { reportId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as PatchBody;
    const report = await supabaseAdmin.from("user_reports").select("*").eq("id", reportId).maybeSingle();
    if (report.error || !report.data) return NextResponse.json({ error: report.error?.message || "找不到檢舉。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 404 });

    let linkedCaseId = report.data.linked_moderation_case_id ?? null;
    if (body.create_case && !linkedCaseId) {
      const newCase = await supabaseAdmin.from("moderation_cases").insert({
        source_report_id: reportId,
        target_type: report.data.target_type,
        target_user_id: report.data.target_user_id,
        target_room_id: report.data.target_room_id,
        status: "open",
        severity: report.data.severity,
        summary: cleanText(report.data.description, 1000),
        assigned_admin_user_id: admin.userId,
        metadata: { category: report.data.category, permission: "safety.manage" },
      }).select("*").single();
      if (newCase.error || !newCase.data) return NextResponse.json({ error: newCase.error?.message || "建立 moderation case 失敗。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
      linkedCaseId = newCase.data.id;
    }

    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (body.status) {
      assertReportTransition(report.data.status, body.status);
      patch.status = body.status;
    }
    if (body.admin_note !== undefined) patch.admin_note = cleanText(body.admin_note, 6000);
    if (linkedCaseId) patch.linked_moderation_case_id = linkedCaseId;
    const updated = await supabaseAdmin.from("user_reports").update(patch).eq("id", reportId).select("*").single();
    if (updated.error || !updated.data) return NextResponse.json({ error: updated.error?.message || "更新檢舉失敗。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });

    await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "admin_user_report_updated", targetType: "user_report", targetId: reportId, metadata: { from_status: report.data.status, to_status: updated.data.status, linked_case_id: linkedCaseId, required_permission: "safety.manage" } });
    return NextResponse.json({ report: updated.data, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}
