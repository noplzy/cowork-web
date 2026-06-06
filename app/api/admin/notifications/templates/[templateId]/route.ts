import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit } from "@/lib/server/adminAuth";

export const runtime = "nodejs";
type Context = { params: Promise<{ templateId: string }> };

export async function PATCH(req: Request, context: Context) {
  try {
    const admin = await getAdminUserFromRequest(req);
    const { templateId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
    if (body.category !== undefined) patch.category = String(body.category).slice(0, 40);
    if (body.channel !== undefined) patch.channel = String(body.channel).slice(0, 40);
    if (body.locale !== undefined) patch.locale = String(body.locale).slice(0, 12);
    if (body.subject_template !== undefined) patch.subject_template = body.subject_template ? String(body.subject_template).slice(0, 300) : null;
    if (body.body_template !== undefined) patch.body_template = String(body.body_template).slice(0, 8000);
    if (Array.isArray(body.required_variables)) patch.required_variables = body.required_variables.map((item: any) => String(item).slice(0, 60));
    if (body.metadata !== undefined) patch.metadata = body.metadata || {};
    const result = await supabaseAdmin.from("notification_templates").update(patch).eq("id", templateId).select("*").single();
    if (result.error || !result.data) return NextResponse.json({ error: result.error?.message || "更新通知模板失敗。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "admin_notification_template_updated", targetType: "notification_template", targetId: templateId, metadata: { template_key: result.data.template_key } });
    return NextResponse.json({ template: result.data, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}
