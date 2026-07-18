import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { ROOM_SUMMARY_BUILD_TAG } from "@/lib/server/roomSummary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ roomId: string }> };

export async function GET(req: Request, context: Context) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { roomId } = await context.params;

    const participantResult = await supabaseAdmin
      .from("room_participant_summaries")
      .select("*")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();
    if (participantResult.error) throw new Error(participantResult.error.message);
    if (!participantResult.data) {
      return NextResponse.json(
        { error: "Room history not found", build_tag: ROOM_SUMMARY_BUILD_TAG },
        { status: 404 },
      );
    }

    const [roomResult, sessionResult, accessResult, reliabilityResult] =
      await Promise.all([
        supabaseAdmin
          .from("rooms")
          .select("id,title,room_category,mode,visibility,created_at,started_at,scheduled_end_at,ended_at,cleanup_reason,status")
          .eq("id", roomId)
          .maybeSingle(),
        supabaseAdmin
          .from("room_session_summaries")
          .select("*")
          .eq("room_id", roomId)
          .maybeSingle(),
        supabaseAdmin
          .from("room_access_sessions")
          .select("id,duration_minutes,entitlement_source,charge_status,connected_at,disconnected_at,connected_seconds,visual_seconds,audio_only_seconds,screen_share_seconds,billing_media_class,usage_status,reconciled_at,reconciliation_source")
          .eq("room_id", roomId)
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabaseAdmin
          .from("reliability_events")
          .select("id,event_type,severity,source,metadata,created_at")
          .eq("room_id", roomId)
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

    const firstError = [
      roomResult.error,
      sessionResult.error,
      accessResult.error,
      reliabilityResult.error,
    ].find(Boolean);
    if (firstError) throw new Error(firstError.message);

    return NextResponse.json(
      {
        ok: true,
        room: roomResult.data,
        summary: sessionResult.data,
        participant: participantResult.data,
        access_sessions: accessResult.data ?? [],
        reliability_events: reliabilityResult.data ?? [],
        privacy_notice: "此頁不儲存逐字稿、原始影像或完整語音。",
        build_tag: ROOM_SUMMARY_BUILD_TAG,
      },
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
