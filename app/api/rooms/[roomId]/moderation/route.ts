import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { assertRoomOperationalMembership } from "@/lib/server/roomOperationalSnapshot";
import { cleanText, insertReliabilityEvent } from "@/lib/server/safety";
import { P4A_BUILD_TAGS } from "@/lib/p4aStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ roomId: string }> };
type Body = {
  target_user_id?: string;
  category?: string;
  description?: string;
  severity?: string;
};

const CATEGORIES = new Set([
  "harassment",
  "sexual",
  "spam",
  "scam",
  "illegal",
  "self_harm",
  "privacy",
  "impersonation",
  "other",
]);
const SEVERITIES = new Set(["low", "normal", "high", "critical"]);

export async function POST(req: Request, context: Context) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { roomId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as Body;
    const targetUserId = cleanText(body.target_user_id, 80);
    const description = cleanText(body.description, 3000);
    const category = CATEGORIES.has(String(body.category))
      ? String(body.category)
      : "other";
    const severity = SEVERITIES.has(String(body.severity))
      ? String(body.severity)
      : category === "sexual" || category === "scam"
        ? "high"
        : "normal";

    if (!targetUserId || targetUserId === userId) {
      return NextResponse.json(
        { error: "請選擇房內其他使用者。", build_tag: P4A_BUILD_TAGS.moderation },
        { status: 400 },
      );
    }
    if (description.length < 10) {
      return NextResponse.json(
        { error: "請以至少 10 個字說明情況。", build_tag: P4A_BUILD_TAGS.moderation },
        { status: 400 },
      );
    }

    const { memberIds } = await assertRoomOperationalMembership(roomId, userId);
    if (!memberIds.includes(targetUserId)) {
      return NextResponse.json(
        { error: "目標使用者不在這個房間的成員名單。", build_tag: P4A_BUILD_TAGS.moderation },
        { status: 403 },
      );
    }

    const insert = await supabaseAdmin
      .from("user_reports")
      .insert({
        reporter_user_id: userId,
        target_type: "user",
        target_user_id: targetUserId,
        target_room_id: roomId,
        category,
        description,
        severity,
        status: "open",
        metadata: {
          source: "room_operational_dock_v140",
          build_tag: P4A_BUILD_TAGS.moderation,
        },
      })
      .select("id,status,category,severity,created_at")
      .single();

    if (insert.error || !insert.data) {
      return NextResponse.json(
        { error: insert.error?.message || "建立檢舉失敗。", build_tag: P4A_BUILD_TAGS.moderation },
        { status: 400 },
      );
    }

    await insertReliabilityEvent({
      userId: targetUserId,
      roomId,
      eventType: "report_received",
      severity: severity as any,
      source: "room_operational_dock_v140",
      metadata: {
        report_id: insert.data.id,
        category,
        reporter_user_id: userId,
        build_tag: P4A_BUILD_TAGS.moderation,
      },
    }).catch(() => undefined);

    return NextResponse.json({
      report: insert.data,
      build_tag: P4A_BUILD_TAGS.moderation,
    });
  } catch (error: any) {
    const status =
      error?.status ||
      (error?.message === "UNAUTHORIZED"
        ? 401
        : error?.message === "ROOM_NOT_FOUND"
          ? 404
          : error?.message === "NOT_A_MEMBER"
            ? 403
            : 500);
    return NextResponse.json(
      { error: error?.message || "送出檢舉失敗。", build_tag: P4A_BUILD_TAGS.moderation },
      { status },
    );
  }
}
