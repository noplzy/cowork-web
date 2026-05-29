import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  ROOM_INFRA_BUILD_TAG,
  isInternalCronRequest,
  parseDailyRoomNameFromUrl,
  tryDeleteDailyRoom,
} from "@/lib/server/roomInfra";

export const runtime = "nodejs";

const CLEANUP_GRACE_MINUTES = 5;
const PRESENCE_GRACE_MINUTES = 10;

export async function POST(req: Request) {
  if (!isInternalCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 401 });
  }

  try {
    const candidatesResult = await supabaseAdmin
      .from("rooms")
      .select("id,title,daily_room_url,status,scheduled_end_at,last_presence_at,created_at,duration_minutes")
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(120);

    if (candidatesResult.error) {
      return NextResponse.json({ error: candidatesResult.error.message, build_tag: ROOM_INFRA_BUILD_TAG }, { status: 500 });
    }

    const rpcResult = await supabaseAdmin.rpc("cowork_cleanup_expired_rooms", {
      p_grace_minutes: CLEANUP_GRACE_MINUTES,
      p_presence_grace_minutes: PRESENCE_GRACE_MINUTES,
    });

    if (rpcResult.error) {
      return NextResponse.json({ error: rpcResult.error.message, build_tag: ROOM_INFRA_BUILD_TAG }, { status: 500 });
    }

    const roomIds = Array.isArray(rpcResult.data?.room_ids) ? rpcResult.data.room_ids : [];
    const shouldDeleteDaily = String(process.env.DAILY_DELETE_ENDED_ROOMS || "").toLowerCase() === "true";
    const dailyDeletes: Array<Record<string, unknown>> = [];

    if (shouldDeleteDaily && roomIds.length > 0) {
      const endedResult = await supabaseAdmin
        .from("rooms")
        .select("id,daily_room_url")
        .in("id", roomIds);

      if (!endedResult.error) {
        for (const room of endedResult.data ?? []) {
          const roomName = parseDailyRoomNameFromUrl((room as any).daily_room_url);
          if (!roomName) continue;
          const deleted = await tryDeleteDailyRoom(roomName).catch((error: any) => ({ ok: false, reason: error?.message || "delete_exception" }));
          dailyDeletes.push({ room_id: (room as any).id, room_name: roomName, ...deleted });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      build_tag: ROOM_INFRA_BUILD_TAG,
      scanned: (candidatesResult.data ?? []).length,
      cleanup: rpcResult.data,
      daily_delete_enabled: shouldDeleteDaily,
      daily_deletes: dailyDeletes,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unexpected server error", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
