import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { NOTIFICATION_OUTBOX_BUILD_TAG } from "@/lib/server/notificationOutbox";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const url = new URL(req.url);
    const unreadOnly = url.searchParams.get("unread") === "1";
    let query = supabaseAdmin
      .from("notification_outbox")
      .select("id,channel,template_key,subject,body,status,priority,target_type,target_id,sent_at,read_at,dismissed_at,created_at,metadata")
      .eq("user_id", userId)
      .neq("status", "cancelled")
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(80);

    if (unreadOnly) query = query.is("read_at", null);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message, build_tag: NOTIFICATION_OUTBOX_BUILD_TAG }, { status: 400 });
    return NextResponse.json({ notifications: data ?? [], build_tag: NOTIFICATION_OUTBOX_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "請先登入後再查看通知。", build_tag: NOTIFICATION_OUTBOX_BUILD_TAG }, { status: 401 });
    return NextResponse.json({ error: error?.message || "讀取通知失敗。", build_tag: NOTIFICATION_OUTBOX_BUILD_TAG }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").trim();
    const now = new Date().toISOString();

    if (action === "mark_all_read") {
      const { error } = await supabaseAdmin
        .from("notification_outbox")
        .update({ read_at: now, status: "read", updated_at: now })
        .eq("user_id", userId)
        .is("read_at", null)
        .in("status", ["sent", "queued", "manual_required"]);
      if (error) return NextResponse.json({ error: error.message, build_tag: NOTIFICATION_OUTBOX_BUILD_TAG }, { status: 400 });
      return NextResponse.json({ ok: true, build_tag: NOTIFICATION_OUTBOX_BUILD_TAG });
    }

    return NextResponse.json({ error: "無效的通知操作。", build_tag: NOTIFICATION_OUTBOX_BUILD_TAG }, { status: 400 });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "請先登入後再操作通知。", build_tag: NOTIFICATION_OUTBOX_BUILD_TAG }, { status: 401 });
    return NextResponse.json({ error: error?.message || "通知操作失敗。", build_tag: NOTIFICATION_OUTBOX_BUILD_TAG }, { status: 500 });
  }
}
