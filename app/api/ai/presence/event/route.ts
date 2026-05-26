import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAiConfig } from "@/lib/ai/aiConfig";
import { AiRoomAccessError, getAiRoomContextFromRequest } from "@/lib/ai/roomAccess";

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

  if (allowed.includes(value as EventType)) {
    return value as EventType;
  }

  return "heartbeat";
}

export async function POST(req: Request) {
  try {
    const config = getAiConfig();
    if (!config.featureEnabled) {
      return NextResponse.json({ error: "AI feature is disabled" }, { status: 403 });
    }

    const body = (await req.json()) as Body;
    const roomId = (body.roomId || "").trim();
    const context = await getAiRoomContextFromRequest(req, roomId);
    const eventType = normalizeEventType(body.eventType);
    const presenceMode = normalizePresenceMode(body.presenceMode);

    const { data, error } = await supabaseAdmin
      .from("room_presence_events")
      .insert({
        room_id: context.room.id,
        user_id: context.userId,
        presence_mode: presenceMode,
        event_type: eventType,
        heartbeat_at: eventType === "heartbeat" ? new Date().toISOString() : null,
        visible_state: (body.visibleState || "").slice(0, 40) || null,
        media_track_state: body.mediaTrackState && typeof body.mediaTrackState === "object" ? body.mediaTrackState : {},
        brb_until: body.brbUntil || null,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      id: data?.id,
      presenceMode,
      eventType,
    });
  } catch (error: any) {
    if (error instanceof AiRoomAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ error: error?.message || "Unexpected server error" }, { status: 500 });
  }
}
