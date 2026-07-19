import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  ADMIN_OPS_BUILD_TAG,
  adminErrorResponse,
  getAdminUserFromRequest,
  writeAdminAudit,
} from "@/lib/server/adminAuth";
import { cleanText } from "@/lib/server/safety";
import {
  assertModerationActionType,
  assertModerationTransition,
  assertTrustSeverity,
} from "@/lib/server/trustOps";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ caseId: string }> };
type PatchBody = { status?: string; severity?: string; summary?: string; action_type?: string; reason?: string; expires_at?: string | null };

export async function GET(req: Request, context: RouteContext) {
  try {
    const admin = await getAdminUserFromRequest(req, { permission: "safety.manage" });
    const { caseId } = await context.params;
    const [modCase, actions, appeals] = await Promise.all([
      supabaseAdmin.from("moderation_cases").select("*").eq("id", caseId).maybeSingle(),
      supabaseAdmin.from("moderation_actions").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
      supabaseAdmin.from("appeals").select("id,status,user_id,moderation_action_id,reason_code,updated_at").eq("moderation_case_id", caseId).order("updated_at", { ascending: false }),
    ]);
    if (modCase.error || !modCase.data) return NextResponse.json({ error: modCase.error?.message || "找不到 moderation case。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 404 });
    if (actions.error) throw actions.error;
    if (appeals.error) throw appeals.error;
    await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "admin_moderation_case_viewed", targetType: "moderation_case", targetId: caseId, metadata: { required_permission: "safety.manage" } });
    return NextResponse.json({ case: modCase.data, actions: actions.data ?? [], appeals: appeals.data ?? [], build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const admin = await getAdminUserFromRequest(req, { permission: "safety.manage" });
    const { caseId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as PatchBody;
    const current = await supabaseAdmin.from("moderation_cases").select("*").eq("id", caseId).maybeSingle();
    if (current.error || !current.data) return NextResponse.json({ error: current.error?.message || "找不到 moderation case。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 404 });

    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (body.status) {
      const status = cleanText(body.status, 40);
      assertModerationTransition(current.data.status, status);
      patch.status = status;
      patch.closed_at = ["dismissed", "closed", "actioned"].includes(status) ? new Date().toISOString() : null;
    }
    if (body.severity) {
      const severity = cleanText(body.severity, 40);
      assertTrustSeverity(severity);
      patch.severity = severity;
    }
    if (body.summary !== undefined) patch.summary = cleanText(body.summary, 1000);

    const updated = await supabaseAdmin.from("moderation_cases").update(patch).eq("id", caseId).select("*").single();
    if (updated.error || !updated.data) return NextResponse.json({ error: updated.error?.message || "更新 moderation case 失敗。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });

    let action = null;
    if (body.action_type) {
      const actionType = cleanText(body.action_type, 60);
      assertModerationActionType(actionType);
      const insertedAction = await supabaseAdmin.from("moderation_actions").insert({
        case_id: caseId,
        actor_admin_user_id: admin.userId,
        target_user_id: current.data.target_user_id,
        action_type: actionType,
        reason: cleanText(body.reason, 2000),
        expires_at: body.expires_at || null,
        metadata: { case_status: updated.data.status, permission: "safety.manage" },
      }).select("*").single();
      if (insertedAction.error) return NextResponse.json({ error: insertedAction.error.message, build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
      action = insertedAction.data;
    }

    await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "admin_moderation_case_updated", targetType: "moderation_case", targetId: caseId, metadata: { from_status: current.data.status, to_status: updated.data.status, action_type: body.action_type || null, required_permission: "safety.manage" } });
    return NextResponse.json({ case: updated.data, action, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}
