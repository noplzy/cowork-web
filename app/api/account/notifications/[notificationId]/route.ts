import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { NOTIFICATION_OUTBOX_BUILD_TAG } from "@/lib/server/notificationOutbox";

export const runtime = "nodejs";
type Context = { params: Promise<{ notificationId: string }> };

export async function PATCH(req: Request, context: Context) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { notificationId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "read").trim();
    const now = new Date().toISOString();
    const patch: Record<string, any> = { updated_at: now };

    if (action === "read") {
      patch.read_at = now;
      patch.status = "read";
    } else if (action === "dismiss") {
      patch.dismissed_at = now;
      patch.status = "dismissed";
    } else {
      return NextResponse.json({ error: "無效的通知操作。", build_tag: NOTIFICATION_OUTBOX_BUILD_TAG }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("notification_outbox")
      .update(patch)
      .eq("id", notificationId)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error || !data) return NextResponse.json({ error: error?.message || "找不到通知。", build_tag: NOTIFICATION_OUTBOX_BUILD_TAG }, { status: 404 });
    return NextResponse.json({ notification: data, build_tag: NOTIFICATION_OUTBOX_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "請先登入後再操作通知。", build_tag: NOTIFICATION_OUTBOX_BUILD_TAG }, { status: 401 });
    return NextResponse.json({ error: error?.message || "通知操作失敗。", build_tag: NOTIFICATION_OUTBOX_BUILD_TAG }, { status: 500 });
  }
}
