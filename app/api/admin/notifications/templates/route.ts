import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit } from "@/lib/server/adminAuth";
import { listNotificationTemplates } from "@/lib/server/notificationTemplates";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const admin = await getAdminUserFromRequest(req);
    const templates = await listNotificationTemplates();
    await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "admin_notification_templates_viewed", targetType: "notification_templates" });
    return NextResponse.json({ templates, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminUserFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const payload = {
      template_key: String(body.template_key || "").trim().slice(0, 120),
      category: String(body.category || "system").trim().slice(0, 40),
      channel: String(body.channel || "in_app").trim().slice(0, 40),
      locale: String(body.locale || "zh-TW").trim().slice(0, 12),
      subject_template: body.subject_template ? String(body.subject_template).slice(0, 300) : null,
      body_template: String(body.body_template || "").trim().slice(0, 8000),
      enabled: body.enabled !== false,
      required_variables: Array.isArray(body.required_variables) ? body.required_variables.map((item: any) => String(item).slice(0, 60)) : [],
      metadata: body.metadata || {},
    };
    if (!payload.template_key || !payload.body_template) {
      return NextResponse.json({ error: "template_key 與 body_template 不能空白。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    }
    const result = await supabaseAdmin.from("notification_templates").upsert(payload, { onConflict: "template_key" }).select("*").single();
    if (result.error || !result.data) return NextResponse.json({ error: result.error?.message || "儲存通知模板失敗。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "admin_notification_template_upserted", targetType: "notification_template", targetId: result.data.id, metadata: { template_key: result.data.template_key, channel: result.data.channel } });
    return NextResponse.json({ template: result.data, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}
