import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { NOTIFICATION_TEMPLATES_BUILD_TAG, getNotificationPreferences, updateNotificationPreferences } from "@/lib/server/notificationTemplates";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const preferences = await getNotificationPreferences(userId);
    return NextResponse.json({ preferences, build_tag: NOTIFICATION_TEMPLATES_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "請先登入後再查看通知偏好。", build_tag: NOTIFICATION_TEMPLATES_BUILD_TAG }, { status: 401 });
    return NextResponse.json({ error: error?.message || "讀取通知偏好失敗。", build_tag: NOTIFICATION_TEMPLATES_BUILD_TAG }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const preferences = await updateNotificationPreferences(userId, body);
    return NextResponse.json({ preferences, build_tag: NOTIFICATION_TEMPLATES_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "請先登入後再修改通知偏好。", build_tag: NOTIFICATION_TEMPLATES_BUILD_TAG }, { status: 401 });
    return NextResponse.json({ error: error?.message || "更新通知偏好失敗。", build_tag: NOTIFICATION_TEMPLATES_BUILD_TAG }, { status: 500 });
  }
}
