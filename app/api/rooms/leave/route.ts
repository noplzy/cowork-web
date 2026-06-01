import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { ROOM_INFRA_BUILD_TAG, parseDailyRoomNameFromUrl, tryDeleteDailyRoom } from "@/lib/server/roomInfra";

export const runtime = "nodejs";

type LeaveBody = {
  roomId?: string;
  reason?: string | null;
};

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const body = (await req.json().catch(() => ({}))) as LeaveBody;
    const roomId = (body.roomId || "").trim();

    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 400 });
    }

    const result = await supabaseAdmin.rpc("cowork_leave_room", {
      p_room_id: roomId,
      p_user_id: userId,
      p_reason: (body.reason || "user_leave").slice(0, 80),
    });

    if (result.error) {
      return NextResponse.json({ error: result.error.message, build_tag: ROOM_INFRA_BUILD_TAG }, { status: 500 });
    }

    const payload = (result.data ?? {}) as any;
    const dailyRoomName = payload?.room_ended ? parseDailyRoomNameFromUrl(payload?.daily_room_url) : null;
    let dailyDelete: Record<string, unknown> | null = null;

    if (dailyRoomName) {
      dailyDelete = await tryDeleteDailyRoom(dailyRoomName).catch((error: any) => ({
        ok: false,
        reason: error?.message || "daily_delete_exception",
      }));
    }

    return NextResponse.json({
      ...payload,
      daily_room_name: dailyRoomName,
      daily_delete: dailyDelete,
      build_tag: ROOM_INFRA_BUILD_TAG,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 401 });
    }

    return NextResponse.json({ error: error?.message || "Unexpected server error", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 500 });
  }
}
