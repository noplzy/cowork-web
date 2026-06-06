import { NextResponse } from "next/server";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit } from "@/lib/server/adminAuth";
import { queueTemplateNotification } from "@/lib/server/notificationTemplates";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const admin = await getAdminUserFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const userId = String(body.user_id || "").trim();
    const templateKey = String(body.template_key || "").trim();
    const channels = Array.isArray(body.channels) ? body.channels : ["in_app"];
    if (!userId || !templateKey) return NextResponse.json({ error: "user_id 與 template_key 不能空白。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    const queued = await queueTemplateNotification({
      userId,
      templateKey,
      channels,
      variables: body.variables || {},
      priority: body.priority || "normal",
      targetType: body.target_type || null,
      targetId: body.target_id || null,
      dedupeKey: body.dedupe_key || null,
      force: Boolean(body.force),
      recipient: body.recipient || null,
    });
    await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "admin_template_notification_queued", targetType: "user", targetId: userId, metadata: { template_key: templateKey, channels } });
    return NextResponse.json({ queued, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}
