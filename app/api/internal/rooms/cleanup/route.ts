import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  ROOM_INFRA_BUILD_TAG,
  isInternalCronRequest,
  listManagedDailyRooms,
  parseDailyRoomNameFromUrl,
  tryDeleteDailyRoom,
} from "@/lib/server/roomInfra";

export const runtime = "nodejs";

const CLEANUP_GRACE_MINUTES = 5;
const PRESENCE_GRACE_MINUTES = 10;

function dailyDeleteEnabled(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("daily") === "1") return true;
  return String(process.env.DAILY_DELETE_ENDED_ROOMS || "").toLowerCase() === "true";
}

export async function POST(req: Request) {
  if (!isInternalCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 401 });
  }

  try {
    const shouldDeleteDaily = dailyDeleteEnabled(req);

    const candidatesResult = await supabaseAdmin
      .from("rooms")
      .select("id,title,daily_room_url,status,scheduled_end_at,last_presence_at,created_at,duration_minutes")
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(200);

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

    const cleanupRoomIds = Array.isArray(rpcResult.data?.room_ids) ? rpcResult.data.room_ids : [];
    const dailyDeletes: Array<Record<string, unknown>> = [];
    const orphanDeletes: Array<Record<string, unknown>> = [];

    if (shouldDeleteDaily) {
      const endedResult = await supabaseAdmin
        .from("rooms")
        .select("id,daily_room_url,status,ended_at")
        .or(`id.in.(${cleanupRoomIds.join(",")}),status.eq.ended`)
        .not("daily_room_url", "is", null)
        .limit(300);

      if (!endedResult.error) {
        const seen = new Set<string>();
        for (const room of endedResult.data ?? []) {
          const roomName = parseDailyRoomNameFromUrl((room as any).daily_room_url);
          if (!roomName || seen.has(roomName)) continue;
          seen.add(roomName);
          const deleted = await tryDeleteDailyRoom(roomName).catch((error: any) => ({ ok: false, reason: error?.message || "delete_exception" }));
          dailyDeletes.push({ room_id: (room as any).id, room_name: roomName, ...deleted });
        }
      }

      const activeRoomsResult = await supabaseAdmin
        .from("rooms")
        .select("id,daily_room_url,status")
        .eq("status", "active")
        .not("daily_room_url", "is", null)
        .limit(500);

      const activeDailyRoomNames = new Set(
        (activeRoomsResult.data ?? [])
          .map((room: any) => parseDailyRoomNameFromUrl(room.daily_room_url))
          .filter(Boolean) as string[]
      );

      const dailyRoomsResult = await listManagedDailyRooms(100);
      if (dailyRoomsResult.ok) {
        for (const dailyRoom of dailyRoomsResult.rooms) {
          const roomName = dailyRoom.name || "";
          if (!roomName || activeDailyRoomNames.has(roomName)) continue;

          const deleted = await tryDeleteDailyRoom(roomName).catch((error: any) => ({ ok: false, reason: error?.message || "delete_exception" }));
          orphanDeletes.push({ room_name: roomName, created_at: dailyRoom.created_at ?? null, ...deleted });
        }
      } else {
        orphanDeletes.push({ ok: false, reason: dailyRoomsResult.error || "daily_list_failed" });
      }
    }

    return NextResponse.json({
      ok: true,
      build_tag: ROOM_INFRA_BUILD_TAG,
      scanned: (candidatesResult.data ?? []).length,
      cleanup: rpcResult.data,
      daily_delete_enabled: shouldDeleteDaily,
      daily_deletes: dailyDeletes,
      orphan_daily_deletes: orphanDeletes,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unexpected server error", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
