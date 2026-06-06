import { NextResponse } from "next/server";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit } from "@/lib/server/adminAuth";
import { adminNotes, safeRows, safeSingle } from "@/lib/server/admin360";

export const runtime = "nodejs";
type Context = { params: Promise<{ roomId: string }> };

export async function GET(req: Request, context: Context) {
  try {
    const admin = await getAdminUserFromRequest(req);
    const { roomId } = await context.params;
    const [room, members, accessSessions, presenceEvents, reliabilityEvents, sponsorPasses, aiSessions, aiUsage, notes] = await Promise.all([
      safeSingle("rooms", (q) => q.eq("id", roomId).maybeSingle()),
      safeRows("room_members", (q) => q.eq("room_id", roomId).order("joined_at", { ascending: true })),
      safeRows("room_access_sessions", (q) => q.eq("room_id", roomId).order("created_at", { ascending: false }).limit(80)),
      safeRows("room_presence_events", (q) => q.eq("room_id", roomId).order("created_at", { ascending: false }).limit(120)),
      safeRows("reliability_events", (q) => q.eq("room_id", roomId).order("created_at", { ascending: false }).limit(80)),
      safeRows("room_sponsor_passes", (q) => q.eq("room_id", roomId).order("created_at", { ascending: false }).limit(80)),
      safeRows("ai_room_host_sessions", (q) => q.eq("room_id", roomId).order("created_at", { ascending: false }).limit(80)),
      safeRows("ai_usage_events", (q) => q.eq("room_id", roomId).order("created_at", { ascending: false }).limit(120)),
      adminNotes("room", roomId),
    ]);
    await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "admin_room_360_viewed", targetType: "room", targetId: roomId });
    return NextResponse.json({ room: room.data, sections: { members, access_sessions: accessSessions, presence_events: presenceEvents, reliability_events: reliabilityEvents, sponsor_passes: sponsorPasses, ai_sessions: aiSessions, ai_usage: aiUsage, notes }, errors: [room.error].filter(Boolean), build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) { const res = adminErrorResponse(error); return NextResponse.json(res.body, { status: res.status }); }
}
