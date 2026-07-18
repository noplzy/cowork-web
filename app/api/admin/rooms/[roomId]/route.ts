import { NextResponse } from "next/server";
import {
  ADMIN_OPS_BUILD_TAG,
  adminErrorResponse,
  getAdminUserFromRequest,
  writeAdminAudit,
} from "@/lib/server/adminAuth";
import { adminNotes, safeRows, safeSingle } from "@/lib/server/admin360";
import { ROOM_PRESENCE_BUILD_TAG } from "@/lib/server/roomPresence";
import { ROOM_SUMMARY_BUILD_TAG } from "@/lib/server/roomSummary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ roomId: string }> };

export async function GET(req: Request, context: Context) {
  try {
    const admin = await getAdminUserFromRequest(req);
    const { roomId } = await context.params;
    const [
      room,
      members,
      accessSessions,
      presenceEvents,
      currentPresence,
      extensionConfirmations,
      roomSummary,
      participantSummaries,
      reliabilityEvents,
      sponsorPasses,
      aiSessions,
      aiUsage,
      notes,
    ] = await Promise.all([
      safeSingle("rooms", (query) => query.eq("id", roomId).maybeSingle()),
      safeRows("room_members", (query) =>
        query.eq("room_id", roomId).order("joined_at", { ascending: true }),
      ),
      safeRows("room_access_sessions", (query) =>
        query.eq("room_id", roomId).order("created_at", { ascending: false }).limit(120),
      ),
      safeRows("room_presence_events", (query) =>
        query.eq("room_id", roomId).order("created_at", { ascending: false }).limit(240),
      ),
      safeRows("room_member_presence_state", (query) =>
        query.eq("room_id", roomId).order("updated_at", { ascending: false }).limit(20),
      ),
      safeRows("room_extension_confirmations", (query) =>
        query.eq("room_id", roomId).order("created_at", { ascending: false }).limit(100),
      ),
      safeSingle("room_session_summaries", (query) =>
        query.eq("room_id", roomId).maybeSingle(),
      ),
      safeRows("room_participant_summaries", (query) =>
        query.eq("room_id", roomId).order("generated_at", { ascending: false }).limit(20),
      ),
      safeRows("reliability_events", (query) =>
        query.eq("room_id", roomId).order("created_at", { ascending: false }).limit(120),
      ),
      safeRows("room_sponsor_passes", (query) =>
        query.eq("room_id", roomId).order("created_at", { ascending: false }).limit(80),
      ),
      safeRows("ai_room_host_sessions", (query) =>
        query.eq("room_id", roomId).order("created_at", { ascending: false }).limit(80),
      ),
      safeRows("ai_usage_events", (query) =>
        query.eq("room_id", roomId).order("created_at", { ascending: false }).limit(120),
      ),
      adminNotes("room", roomId),
    ]);

    await writeAdminAudit(req, {
      adminUserId: admin.userId,
      actionType: "admin_room_360_viewed",
      targetType: "room",
      targetId: roomId,
      metadata: {
        presence_build_tag: ROOM_PRESENCE_BUILD_TAG,
        summary_build_tag: ROOM_SUMMARY_BUILD_TAG,
      },
    });

    return NextResponse.json(
      {
        room: room.data,
        sections: {
          members,
          access_sessions: accessSessions,
          presence_events: presenceEvents,
          current_presence: currentPresence,
          extension_confirmations: extensionConfirmations,
          room_summary: roomSummary,
          participant_summaries: participantSummaries,
          reliability_events: reliabilityEvents,
          sponsor_passes: sponsorPasses,
          ai_sessions: aiSessions,
          ai_usage: aiUsage,
          notes,
        },
        errors: [room.error].filter(Boolean),
        build_tag: ADMIN_OPS_BUILD_TAG,
        p0_build_tags: {
          presence: ROOM_PRESENCE_BUILD_TAG,
          summary: ROOM_SUMMARY_BUILD_TAG,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const response = adminErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
