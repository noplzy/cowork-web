import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import {
  ROOM_INFRA_BUILD_TAG,
  parseDailyRoomNameFromUrl,
  tryDeleteDailyRoom,
} from "@/lib/server/roomInfra";
import {
  ROOM_SUMMARY_BUILD_TAG,
  summarizeRoom,
} from "@/lib/server/roomSummary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LeaveBody = {
  roomId?: string;
  reason?: string | null;
};

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const body = (await req.json().catch(() => ({}))) as LeaveBody;
    const roomId = String(body.roomId || "").trim();

    if (!roomId) {
      return NextResponse.json(
        { error: "Missing roomId", build_tag: ROOM_INFRA_BUILD_TAG },
        { status: 400 },
      );
    }

    const result = await supabaseAdmin.rpc("cowork_leave_room", {
      p_room_id: roomId,
      p_user_id: userId,
      p_reason: String(body.reason || "user_leave").slice(0, 80),
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message, build_tag: ROOM_INFRA_BUILD_TAG },
        { status: 500 },
      );
    }

    const payload = (result.data ?? {}) as any;
    const dailyRoomName = payload?.room_ended
      ? parseDailyRoomNameFromUrl(payload?.daily_room_url)
      : null;
    let dailyDelete: Record<string, unknown> | null = null;
    let summary: Record<string, unknown> | null = null;

    if (dailyRoomName) {
      dailyDelete = await tryDeleteDailyRoom(dailyRoomName).catch((error) => ({
        ok: false,
        reason:
          error instanceof Error ? error.message : "daily_delete_exception",
      }));
    }

    if (payload?.room_ended) {
      summary = await summarizeRoom(roomId)
        .then((resultPayload) => ({
          ok: true,
          room_id: roomId,
          summary_id: resultPayload.summary?.room_id ?? roomId,
          build_tag: ROOM_SUMMARY_BUILD_TAG,
        }))
        .catch((error) => ({
          ok: false,
          room_id: roomId,
          error: error instanceof Error ? error.message : String(error),
          retry: "/api/internal/rooms/summarize-ended",
          build_tag: ROOM_SUMMARY_BUILD_TAG,
        }));
    }

    return NextResponse.json(
      {
        ...payload,
        daily_room_name: dailyRoomName,
        daily_delete: dailyDelete,
        post_session_summary: summary,
        build_tag: ROOM_INFRA_BUILD_TAG,
        summary_build_tag: ROOM_SUMMARY_BUILD_TAG,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "Unauthorized", build_tag: ROOM_INFRA_BUILD_TAG },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: message, build_tag: ROOM_INFRA_BUILD_TAG },
      { status: 500 },
    );
  }
}
