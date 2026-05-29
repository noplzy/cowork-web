import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { ROOM_INFRA_BUILD_TAG } from "@/lib/server/roomInfra";

export const runtime = "nodejs";

type PresenceMode = "quiet" | "audio" | "mosaic" | "camera";
type EventType =
  | "selected"
  | "heartbeat"
  | "visible"
  | "hidden"
  | "audio_on"
  | "audio_off"
  | "video_on"
  | "video_off"
  | "brb_start"
  | "brb_end"
  | "extension_confirmed"
  | "left";

type Body = {
  roomId?: string;
  accessSessionId?: string | null;
  presenceMode?: PresenceMode;
  eventType?: EventType;
  visibleState?: string;
  mediaTrackState?: Record<string, unknown>;
  brbUntil?: string | null;
};

function normalizePresenceMode(value?: string | null): PresenceMode {
  if (value === "audio" || value === "mosaic" || value === "camera" || value === "quiet") {
    return value;
  }
  return "quiet";
}

function normalizeEventType(value?: string | null): EventType {
  const allowed: EventType[] = [
    "selected",
    "heartbeat",
    "visible",
    "hidden",
    "audio_on",
    "audio_off",
    "video_on",
    "video_off",
    "brb_start",
    "brb_end",
    "extension_confirmed",
    "left",
  ];

  return allowed.includes(value as EventType) ? (value as EventType) : "heartbeat";
}

function normalizeBrbUntil(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const body = (await req.json()) as Body;
    const roomId = (body.roomId || "").trim();

    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 400 });
    }

    const roomResult = await supabaseAdmin
      .from("rooms")
      .select("id,created_by,status,ended_at")
      .eq("id", roomId)
      .maybeSingle();

    if (roomResult.error || !roomResult.data) {
      return NextResponse.json({ error: roomResult.error?.message || "Room not found", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 404 });
    }

    const room = roomResult.data as any;
    if (room.status === "ended" || room.status === "expired" || room.ended_at) {
      return NextResponse.json({ error: "Room has ended", code: "ROOM_ENDED", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 410 });
    }

    const memberResult = await supabaseAdmin
      .from("room_members")
      .select("room_id,user_id")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();

    if (memberResult.error) {
      return NextResponse.json({ error: memberResult.error.message, build_tag: ROOM_INFRA_BUILD_TAG }, { status: 500 });
    }

    const isMember = Boolean(memberResult.data) || room.created_by === userId;
    if (!isMember) {
      return NextResponse.json({ error: "Not a room member", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 403 });
    }

    const eventType = normalizeEventType(body.eventType);
    const presenceMode = normalizePresenceMode(body.presenceMode);
    const nowIso = new Date().toISOString();
    const accessSessionId = (body.accessSessionId || "").trim() || null;
    const brbUntil = normalizeBrbUntil(body.brbUntil);

    const insertResult = await supabaseAdmin
      .from("room_presence_events")
      .insert({
        room_id: roomId,
        user_id: userId,
        presence_mode: presenceMode,
        event_type: eventType,
        heartbeat_at: eventType === "heartbeat" ? nowIso : null,
        visible_state: (body.visibleState || "").slice(0, 40) || null,
        media_track_state: body.mediaTrackState && typeof body.mediaTrackState === "object" ? body.mediaTrackState : {},
        brb_until: brbUntil,
        access_session_id: accessSessionId,
      })
      .select("id")
      .single();

    if (insertResult.error) {
      return NextResponse.json({ error: insertResult.error.message, build_tag: ROOM_INFRA_BUILD_TAG }, { status: 500 });
    }

    const presencePatch = eventType === "left" ? {} : { last_presence_at: nowIso };

    if (Object.keys(presencePatch).length > 0) {
      await supabaseAdmin.from("rooms").update(presencePatch).eq("id", roomId);
    }

    if (accessSessionId) {
      const sessionPatch: Record<string, string | null> = {
        last_presence_at: eventType === "left" ? null : nowIso,
        updated_at: nowIso,
      };

      if (eventType === "selected" || eventType === "heartbeat") {
        sessionPatch.join_confirmed_at = nowIso;
      }

      await supabaseAdmin
        .from("room_access_sessions")
        .update(sessionPatch)
        .eq("id", accessSessionId)
        .eq("room_id", roomId)
        .eq("user_id", userId);
    }

    return NextResponse.json({
      ok: true,
      id: insertResult.data?.id,
      presenceMode,
      eventType,
      access_session_id: accessSessionId,
      build_tag: ROOM_INFRA_BUILD_TAG,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 401 });
    }

    return NextResponse.json({ error: error?.message || "Unexpected server error", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 500 });
  }
}
