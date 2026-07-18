import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import {
  ROOM_PRESENCE_BUILD_TAG,
  recordRoomPresence,
} from "@/lib/server/roomPresence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const body = (await req.json().catch(() => ({}))) as {
      roomId?: string;
      presenceMode?: string;
      accessSessionId?: string | null;
      dailyParticipantState?: string | null;
      mediaTrackState?: Record<string, unknown>;
    };
    const result = await recordRoomPresence({
      userId,
      roomId: body.roomId || "",
      accessSessionId: body.accessSessionId,
      presenceMode: body.presenceMode,
      eventType: "brb_end",
      dailyParticipantState: body.dailyParticipantState,
      mediaTrackState: body.mediaTrackState,
      visibleState: "visible",
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json(
      { error: message, build_tag: ROOM_PRESENCE_BUILD_TAG },
      { status: message === "UNAUTHORIZED" ? 401 : 400 },
    );
  }
}
