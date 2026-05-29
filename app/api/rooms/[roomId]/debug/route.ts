import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { ROOM_INFRA_BUILD_TAG, maskUserId, parseDailyRoomNameFromUrl } from "@/lib/server/roomInfra";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ roomId: string }> };

async function fetchDailyRoom(roomName: string) {
  const dailyKey = process.env.DAILY_API_KEY;
  const dailyApiBase = process.env.DAILY_API_BASE || "https://api.daily.co/v1";

  if (!dailyKey) {
    return { ok: false, configured: false, error: "Missing DAILY_API_KEY" };
  }

  const response = await fetch(`${dailyApiBase}/rooms/${encodeURIComponent(roomName)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${dailyKey}` },
    cache: "no-store",
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      configured: true,
      status: response.status,
      error: json?.info || json?.error || "Daily room lookup failed",
    };
  }

  return {
    ok: true,
    configured: true,
    status: response.status,
    room: {
      name: json?.name ?? null,
      url: json?.url ?? null,
      privacy: json?.privacy ?? null,
      created_at: json?.created_at ?? null,
      config: json?.config ?? json?.properties ?? null,
    },
  };
}

export async function GET(req: Request, context: RouteContext) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { roomId } = await context.params;

    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 400 });
    }

    const roomResult = await supabaseAdmin
      .from("rooms")
      .select("id,title,created_by,created_at,duration_minutes,mode,max_size,daily_room_url,visibility,status,started_at,scheduled_end_at,ended_at,last_presence_at,cleanup_reason")
      .eq("id", roomId)
      .maybeSingle();

    if (roomResult.error || !roomResult.data) {
      return NextResponse.json({ error: roomResult.error?.message || "Room not found", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 404 });
    }

    const room = roomResult.data as any;
    const isOwner = room.created_by === userId;

    const memberResult = await supabaseAdmin
      .from("room_members")
      .select("room_id,user_id")
      .eq("room_id", roomId);

    if (memberResult.error) {
      return NextResponse.json({ error: memberResult.error.message, build_tag: ROOM_INFRA_BUILD_TAG }, { status: 500 });
    }

    const members = (memberResult.data ?? []) as Array<{ user_id: string }>;
    const isMember = isOwner || members.some((item) => item.user_id === userId);

    if (!isMember) {
      return NextResponse.json({ error: "Not a room member", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 403 });
    }

    const [accessSessionsResult, presenceResult] = await Promise.all([
      supabaseAdmin
        .from("room_access_sessions")
        .select("id,user_id,billing_session_key,charge_status,charged_at,last_token_issued_at,token_exp,entitlement_source,allowed_by_pair_vip_carry,status,last_presence_at,last_error,created_at,updated_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabaseAdmin
        .from("room_presence_events")
        .select("id,user_id,presence_mode,event_type,heartbeat_at,visible_state,media_track_state,brb_until,access_session_id,created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const dailyRoomName = parseDailyRoomNameFromUrl(room.daily_room_url);
    const daily = dailyRoomName ? await fetchDailyRoom(dailyRoomName) : { ok: false, configured: Boolean(process.env.DAILY_API_KEY), error: "Missing daily_room_url" };

    return NextResponse.json({
      ok: true,
      build_tag: ROOM_INFRA_BUILD_TAG,
      viewer: {
        user_id_masked: maskUserId(userId),
        is_owner: isOwner,
        is_member: isMember,
      },
      room: {
        ...room,
        created_by: maskUserId(room.created_by),
        daily_room_name: dailyRoomName,
      },
      members: {
        count: members.length,
        user_ids_masked: members.map((item) => maskUserId(item.user_id)),
      },
      access_sessions: accessSessionsResult.error
        ? { error: accessSessionsResult.error.message }
        : (accessSessionsResult.data ?? []).map((item: any) => ({ ...item, user_id: maskUserId(item.user_id) })),
      presence_events: presenceResult.error
        ? { error: presenceResult.error.message }
        : (presenceResult.data ?? []).map((item: any) => ({ ...item, user_id: maskUserId(item.user_id) })),
      daily,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 401 });
    }
    return NextResponse.json({ error: error?.message || "Unexpected server error", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 500 });
  }
}
