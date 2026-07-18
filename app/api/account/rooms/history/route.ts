import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { ROOM_SUMMARY_BUILD_TAG } from "@/lib/server/roomSummary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") || 30), 100));

    const participantResult = await supabaseAdmin
      .from("room_participant_summaries")
      .select("*")
      .eq("user_id", userId)
      .order("generated_at", { ascending: false })
      .limit(limit);
    if (participantResult.error) throw new Error(participantResult.error.message);

    const roomIds = (participantResult.data ?? []).map((row) => row.room_id);
    const sessionResult = roomIds.length
      ? await supabaseAdmin
          .from("room_session_summaries")
          .select("*")
          .in("room_id", roomIds)
      : { data: [], error: null };
    if (sessionResult.error) throw new Error(sessionResult.error.message);

    const sessions = new Map(
      (sessionResult.data ?? []).map((row) => [row.room_id, row]),
    );
    const rows = (participantResult.data ?? []).map((participant) => ({
      room: sessions.get(participant.room_id) ?? null,
      participant,
    }));

    return NextResponse.json(
      { ok: true, rows, build_tag: ROOM_SUMMARY_BUILD_TAG },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json(
      { error: message, build_tag: ROOM_SUMMARY_BUILD_TAG },
      { status: message === "UNAUTHORIZED" ? 401 : 500 },
    );
  }
}
