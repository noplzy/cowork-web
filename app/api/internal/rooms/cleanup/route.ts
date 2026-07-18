import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  ROOM_INFRA_BUILD_TAG,
  isInternalCronRequest,
  listManagedDailyRooms,
  parseDailyRoomNameFromUrl,
  tryDeleteDailyRoom,
} from "@/lib/server/roomInfra";
import {
  ROOM_SUMMARY_BUILD_TAG,
  summarizeRoom,
} from "@/lib/server/roomSummary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLEANUP_GRACE_MINUTES = 5;
const PRESENCE_GRACE_MINUTES = 10;

function dailyDeleteEnabled(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("daily") === "1") return true;
  return (
    String(process.env.DAILY_DELETE_ENDED_ROOMS || "").toLowerCase() ===
    "true"
  );
}

export async function POST(req: Request) {
  if (!isInternalCronRequest(req)) {
    return NextResponse.json(
      { error: "Unauthorized", build_tag: ROOM_INFRA_BUILD_TAG },
      { status: 401 },
    );
  }

  try {
    const shouldDeleteDaily = dailyDeleteEnabled(req);
    const candidatesResult = await supabaseAdmin
      .from("rooms")
      .select(
        "id,title,daily_room_url,status,scheduled_end_at,last_presence_at,created_at,duration_minutes",
      )
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(200);

    if (candidatesResult.error) {
      return NextResponse.json(
        {
          error: candidatesResult.error.message,
          build_tag: ROOM_INFRA_BUILD_TAG,
        },
        { status: 500 },
      );
    }

    const rpcResult = await supabaseAdmin.rpc("cowork_cleanup_expired_rooms", {
      p_grace_minutes: CLEANUP_GRACE_MINUTES,
      p_presence_grace_minutes: PRESENCE_GRACE_MINUTES,
    });
    if (rpcResult.error) {
      return NextResponse.json(
        { error: rpcResult.error.message, build_tag: ROOM_INFRA_BUILD_TAG },
        { status: 500 },
      );
    }

    const cleanupRoomIds = Array.isArray(rpcResult.data?.room_ids)
      ? rpcResult.data.room_ids.map(String)
      : [];
    const summaries: Array<Record<string, unknown>> = [];
    for (const roomId of cleanupRoomIds) {
      const result = await summarizeRoom(roomId)
        .then((payload) => ({
          room_id: roomId,
          ok: true,
          summary_id: payload.summary?.room_id ?? roomId,
        }))
        .catch((error) => ({
          room_id: roomId,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      summaries.push(result);
    }

    const dailyDeletes: Array<Record<string, unknown>> = [];
    const orphanDeletes: Array<Record<string, unknown>> = [];

    if (shouldDeleteDaily) {
      const endedFilter = cleanupRoomIds.length
        ? `id.in.(${cleanupRoomIds.join(",")}),status.eq.ended`
        : "status.eq.ended";
      const endedResult = await supabaseAdmin
        .from("rooms")
        .select("id,daily_room_url,status,ended_at")
        .or(endedFilter)
        .not("daily_room_url", "is", null)
        .limit(300);

      if (!endedResult.error) {
        const seen = new Set<string>();
        for (const room of endedResult.data ?? []) {
          const roomName = parseDailyRoomNameFromUrl(
            (room as any).daily_room_url,
          );
          if (!roomName || seen.has(roomName)) continue;
          seen.add(roomName);
          const deleted = await tryDeleteDailyRoom(roomName).catch((error) => ({
            ok: false,
            reason:
              error instanceof Error ? error.message : "delete_exception",
          }));
          dailyDeletes.push({
            room_id: (room as any).id,
            room_name: roomName,
            ...deleted,
          });
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
          .filter(Boolean) as string[],
      );
      const dailyRoomsResult = await listManagedDailyRooms(100);
      if (dailyRoomsResult.ok) {
        for (const dailyRoom of dailyRoomsResult.rooms) {
          const roomName = dailyRoom.name || "";
          if (!roomName || activeDailyRoomNames.has(roomName)) continue;
          const deleted = await tryDeleteDailyRoom(roomName).catch((error) => ({
            ok: false,
            reason:
              error instanceof Error ? error.message : "delete_exception",
          }));
          orphanDeletes.push({
            room_name: roomName,
            created_at: dailyRoom.created_at ?? null,
            ...deleted,
          });
        }
      } else {
        orphanDeletes.push({
          ok: false,
          reason: dailyRoomsResult.error || "daily_list_failed",
        });
      }
    }

    return NextResponse.json(
      {
        ok: true,
        build_tag: ROOM_INFRA_BUILD_TAG,
        summary_build_tag: ROOM_SUMMARY_BUILD_TAG,
        scanned: (candidatesResult.data ?? []).length,
        cleanup: rpcResult.data,
        post_session_summaries: summaries,
        daily_delete_enabled: shouldDeleteDaily,
        daily_deletes: dailyDeletes,
        orphan_daily_deletes: orphanDeletes,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unexpected server error",
        build_tag: ROOM_INFRA_BUILD_TAG,
      },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  return POST(req);
}
