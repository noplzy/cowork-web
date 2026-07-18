import { NextResponse } from "next/server";
import {
  adminErrorResponse,
  getAdminUserFromRequest,
  writeAdminAudit,
} from "@/lib/server/adminAuth";
import { safeRows, safeSingle } from "@/lib/server/admin360";
import { ROOM_SUMMARY_BUILD_TAG } from "@/lib/server/roomSummary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ roomId: string }> };

export async function GET(req: Request, context: Context) {
  try {
    const admin = await getAdminUserFromRequest(req);
    const { roomId } = await context.params;

    const [room, summary, participants, accessSessions, reliability, presence] =
      await Promise.all([
        safeSingle("rooms", (query) => query.eq("id", roomId).maybeSingle()),
        safeSingle("room_session_summaries", (query) =>
          query.eq("room_id", roomId).maybeSingle(),
        ),
        safeRows("room_participant_summaries", (query) =>
          query
            .eq("room_id", roomId)
            .order("participant_minutes", { ascending: false }),
        ),
        safeRows("room_access_sessions", (query) =>
          query
            .eq("room_id", roomId)
            .order("created_at", { ascending: false })
            .limit(100),
        ),
        safeRows("reliability_events", (query) =>
          query
            .eq("room_id", roomId)
            .order("created_at", { ascending: false })
            .limit(100),
        ),
        safeRows("room_member_presence_state", (query) =>
          query
            .eq("room_id", roomId)
            .order("updated_at", { ascending: false }),
        ),
      ]);

    await writeAdminAudit(req, {
      adminUserId: admin.userId,
      actionType: "admin_room_summary_viewed",
      targetType: "room",
      targetId: roomId,
      metadata: { build_tag: ROOM_SUMMARY_BUILD_TAG },
    });

    return NextResponse.json(
      {
        ok: true,
        room: room.data,
        summary: summary.data,
        sections: {
          participants,
          access_sessions: accessSessions,
          reliability_events: reliability,
          current_presence: presence,
        },
        errors: [room.error, summary.error].filter(Boolean),
        privacy_notice:
          "Room summary 不儲存逐字稿、原始影像或完整語音。",
        build_tag: ROOM_SUMMARY_BUILD_TAG,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const response = adminErrorResponse(error);
    return NextResponse.json(
      { ...response.body, build_tag: ROOM_SUMMARY_BUILD_TAG },
      { status: response.status },
    );
  }
}
