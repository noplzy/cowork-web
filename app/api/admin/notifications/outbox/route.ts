import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit } from "@/lib/server/adminAuth";
import { queueNotification } from "@/lib/server/notificationOutbox";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const admin = await getAdminUserFromRequest(req);
    const url = new URL(req.url);
    const status = String(url.searchParams.get("status") || "").trim();
    const channel = String(url.searchParams.get("channel") || "").trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 120), 1), 200);

    let query = supabaseAdmin.from("notification_outbox").select("*").order("created_at", { ascending: false }).limit(limit);
    if (status) query = query.eq("status", status);
    if (channel) query = query.eq("channel", channel);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message, build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });

    await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "admin_notifications_outbox_viewed", targetType: "notification_outbox", metadata: { status, channel, limit } });
    return NextResponse.json({ notifications: data ?? [], build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminUserFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const notification = await queueNotification({
      userId: body.user_id || null,
      channel: body.channel || "in_app",
      recipient: body.recipient || null,
      templateKey: body.template_key || "admin_manual",
      subject: body.subject || null,
      body: String(body.body || "").slice(0, 8000),
      priority: body.priority || "normal",
      targetType: body.target_type || null,
      targetId: body.target_id || null,
      dedupeKey: body.dedupe_key || null,
      metadata: { source: "admin_notifications_outbox", admin_user_id: admin.userId, ...(body.metadata || {}) },
    });

    if (!notification) return NextResponse.json({ error: "建立通知失敗。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });

    await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "admin_notification_queued", targetType: "notification_outbox", targetId: notification.id });
    return NextResponse.json({ notification, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}
