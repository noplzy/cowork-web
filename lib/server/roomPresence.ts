import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { insertReliabilityEvent } from "@/lib/server/safety";
import { P0_BUILD_TAGS } from "@/lib/p0Status";

export const ROOM_PRESENCE_BUILD_TAG = P0_BUILD_TAGS.presence;

export type PresenceMode = "quiet" | "audio" | "mosaic" | "camera";
export type PresenceEventType =
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

export type DailyParticipantState =
  | "unknown"
  | "joining"
  | "joined"
  | "left"
  | "error";

export type TrackState = "on" | "off" | "unknown";
export type BillingMediaClass =
  | "unknown"
  | "no_media"
  | "audio_only"
  | "video";

export type PresenceMediaState = {
  audio?: boolean | string | null;
  video?: boolean | string | null;
  screen?: boolean | string | null;
  source?: string | null;
  page_hidden?: boolean | null;
  [key: string]: unknown;
};

export type RecordPresenceInput = {
  roomId: string;
  userId: string;
  accessSessionId?: string | null;
  presenceMode?: string | null;
  eventType?: string | null;
  visibleState?: string | null;
  mediaTrackState?: PresenceMediaState | null;
  brbUntil?: string | null;
  dailyParticipantState?: string | null;
  extensionDecision?: "continue" | "leave" | string | null;
};

function clean(value: unknown, max = 120) {
  return String(value ?? "").trim().slice(0, max);
}

export function normalizePresenceMode(value?: string | null): PresenceMode {
  if (
    value === "quiet" ||
    value === "audio" ||
    value === "mosaic" ||
    value === "camera"
  ) {
    return value;
  }
  return "quiet";
}

export function normalizePresenceEventType(
  value?: string | null,
): PresenceEventType {
  const allowed: PresenceEventType[] = [
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
  return allowed.includes(value as PresenceEventType)
    ? (value as PresenceEventType)
    : "heartbeat";
}

export function normalizeDailyParticipantState(
  value?: string | null,
): DailyParticipantState {
  if (
    value === "joining" ||
    value === "joined" ||
    value === "left" ||
    value === "error"
  ) {
    return value;
  }
  return "unknown";
}

function normalizeTrackState(value: unknown): TrackState {
  if (value === true || value === "on" || value === "playable") return "on";
  if (value === false || value === "off" || value === "blocked") return "off";
  return "unknown";
}

function parseBrbUntil(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const max = Date.now() + 10 * 60 * 1000;
  return new Date(Math.min(date.getTime(), max)).toISOString();
}

function mediaClass(input: {
  audio: TrackState;
  video: TrackState;
  screen: TrackState;
}): BillingMediaClass {
  if (input.video === "on" || input.screen === "on") return "video";
  if (input.audio === "on") return "audio_only";
  if (input.audio === "off" && input.video === "off" && input.screen === "off") {
    return "no_media";
  }
  return "unknown";
}

function presenceStatus(input: {
  eventType: PresenceEventType;
  dailyState: DailyParticipantState;
  previous: any | null;
  brbUntil: string | null;
  nowMs: number;
}) {
  if (input.eventType === "left") return "left";
  if (input.dailyState === "left" || input.dailyState === "error") {
    return "disconnected";
  }
  if (input.eventType === "brb_start") return "brb";
  if (input.eventType === "brb_end") return "active";

  const previousBrbUntil = input.previous?.brb_until
    ? new Date(input.previous.brb_until).getTime()
    : null;
  const activeBrbUntil = input.brbUntil
    ? new Date(input.brbUntil).getTime()
    : previousBrbUntil;
  if (
    input.previous?.presence_status === "brb" &&
    activeBrbUntil &&
    activeBrbUntil > input.nowMs
  ) {
    return "brb";
  }

  if (input.eventType === "hidden") return "hidden";
  return "active";
}

function upgradeBillingMediaClass(
  previous: BillingMediaClass | null | undefined,
  current: BillingMediaClass,
): BillingMediaClass {
  const rank: Record<BillingMediaClass, number> = {
    unknown: 0,
    no_media: 1,
    audio_only: 2,
    video: 3,
  };
  const normalizedPrevious = previous || "unknown";
  return rank[current] > rank[normalizedPrevious]
    ? current
    : normalizedPrevious;
}

function isRoomsEntitlementPlan(plan: string, vipUntil?: string | null) {
  const active = !vipUntil || new Date(vipUntil).getTime() > Date.now();
  if (!active) return false;
  return [
    "vip",
    "vip_month",
    "rooms_unlimited_299",
    "whole_site_599",
    "host_999",
  ].includes(plan);
}

async function roomMembership(roomId: string, userId: string) {
  const roomResult = await supabaseAdmin
    .from("rooms")
    .select(
      "id,title,created_by,created_at,started_at,scheduled_end_at,duration_minutes,status,ended_at",
    )
    .eq("id", roomId)
    .maybeSingle();

  if (roomResult.error || !roomResult.data) {
    throw new Error(roomResult.error?.message || "ROOM_NOT_FOUND");
  }

  const room = roomResult.data as any;
  if (room.status === "ended" || room.status === "expired" || room.ended_at) {
    throw new Error("ROOM_ENDED");
  }

  const memberResult = await supabaseAdmin
    .from("room_members")
    .select("room_id,user_id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (memberResult.error) throw new Error(memberResult.error.message);
  if (!memberResult.data && room.created_by !== userId) {
    throw new Error("NOT_A_MEMBER");
  }

  return room;
}

async function resolveAccessSession(input: {
  roomId: string;
  userId: string;
  requestedId?: string | null;
}) {
  if (input.requestedId) {
    const result = await supabaseAdmin
      .from("room_access_sessions")
      .select("*")
      .eq("id", input.requestedId)
      .eq("room_id", input.roomId)
      .eq("user_id", input.userId)
      .maybeSingle();
    if (result.error) throw new Error(result.error.message);
    if (result.data) return result.data as any;
  }

  const result = await supabaseAdmin
    .from("room_access_sessions")
    .select("*")
    .eq("room_id", input.roomId)
    .eq("user_id", input.userId)
    .in("status", ["active", "ended"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) throw new Error(result.error.message);
  return (result.data ?? null) as any;
}

async function ensureReliabilityEvent(input: {
  userId: string;
  roomId: string;
  eventType: string;
  severity: "info" | "low" | "normal" | "high" | "critical";
  metadata?: Record<string, unknown>;
}) {
  const existing = await supabaseAdmin
    .from("reliability_events")
    .select("id")
    .eq("room_id", input.roomId)
    .eq("user_id", input.userId)
    .eq("event_type", input.eventType)
    .eq("source", "room_presence_v128")
    .limit(1)
    .maybeSingle();

  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return;

  await insertReliabilityEvent({
    userId: input.userId,
    roomId: input.roomId,
    eventType: input.eventType,
    severity: input.severity,
    source: "room_presence_v128",
    metadata: input.metadata ?? {},
  });
}

async function writeExtensionConfirmation(input: {
  room: any;
  userId: string;
  accessSessionId: string | null;
  decision: "continue" | "leave";
}) {
  const entitlement = await supabaseAdmin
    .from("user_entitlements")
    .select("plan,vip_until")
    .eq("user_id", input.userId)
    .maybeSingle();

  const plan = String(entitlement.data?.plan || "free");
  const vipUntil = (entitlement.data?.vip_until ?? null) as string | null;
  const roomsEntitled = isRoomsEntitlementPlan(plan, vipUntil);
  const scheduledEnd =
    input.room.scheduled_end_at ||
    new Date(
      new Date(input.room.started_at || input.room.created_at).getTime() +
        Number(input.room.duration_minutes || 25) * 60_000,
    ).toISOString();
  const windowKey = `end:${scheduledEnd}`;

  const result = await supabaseAdmin
    .from("room_extension_confirmations")
    .upsert(
      {
        room_id: input.room.id,
        user_id: input.userId,
        access_session_id: input.accessSessionId,
        extension_window_key: windowKey,
        decision: input.decision,
        requested_extension_minutes: 25,
        is_rooms_entitled: roomsEntitled,
        sponsor_points_required:
          input.decision === "continue" && !roomsEntitled ? 1 : 0,
        current_scheduled_end_at: scheduledEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "room_id,user_id,extension_window_key" },
    )
    .select("*")
    .single();

  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function recordRoomPresence(input: RecordPresenceInput) {
  const roomId = clean(input.roomId, 80);
  if (!roomId) throw new Error("MISSING_ROOM_ID");

  const room = await roomMembership(roomId, input.userId);
  const now = new Date();
  const nowIso = now.toISOString();
  const mode = normalizePresenceMode(input.presenceMode);
  const eventType = normalizePresenceEventType(input.eventType);
  const dailyState = normalizeDailyParticipantState(
    input.dailyParticipantState,
  );
  const brbUntil = parseBrbUntil(input.brbUntil);
  const audioState = normalizeTrackState(input.mediaTrackState?.audio);
  const videoState = normalizeTrackState(input.mediaTrackState?.video);
  const screenState = normalizeTrackState(input.mediaTrackState?.screen);
  const billingMediaClass = mediaClass({
    audio: audioState,
    video: videoState,
    screen: screenState,
  });
  const accessSession = await resolveAccessSession({
    roomId,
    userId: input.userId,
    requestedId: clean(input.accessSessionId, 80) || null,
  });

  const previousResult = await supabaseAdmin
    .from("room_member_presence_state")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (previousResult.error) throw new Error(previousResult.error.message);
  const previous = previousResult.data as any | null;
  const status = presenceStatus({
    eventType,
    dailyState,
    previous,
    brbUntil,
    nowMs: now.getTime(),
  });
  const previousAt = previous?.last_presence_at
    ? new Date(previous.last_presence_at).getTime()
    : now.getTime();
  const rawDelta = Math.floor((now.getTime() - previousAt) / 1000);
  const connected = dailyState === "joined" && eventType !== "left";
  const explicitlyDisconnected =
    eventType === "left" ||
    dailyState === "left" ||
    dailyState === "error";
  const countablePrevious =
    previous &&
    previous.daily_participant_state === "joined" &&
    !["left", "disconnected"].includes(previous.presence_status);
  const deltaSeconds = countablePrevious
    ? Math.max(0, Math.min(rawDelta, 90))
    : 0;
  const intervalMediaClass = previous
    ? mediaClass({
        audio: normalizeTrackState(previous.audio_track_state),
        video: normalizeTrackState(previous.video_track_state),
        screen: normalizeTrackState(previous.screen_track_state),
      })
    : billingMediaClass;
  const intervalScreenShareOn = previous
    ? normalizeTrackState(previous.screen_track_state) === "on"
    : screenState === "on";
  const stateBillingMediaClass = upgradeBillingMediaClass(
    previous?.billing_media_class as BillingMediaClass | undefined,
    billingMediaClass,
  );

  const eventInsert = await supabaseAdmin
    .from("room_presence_events")
    .insert({
      room_id: roomId,
      user_id: input.userId,
      presence_mode: mode,
      event_type: eventType,
      heartbeat_at: eventType === "heartbeat" ? nowIso : null,
      visible_state: clean(input.visibleState, 40) || null,
      media_track_state:
        input.mediaTrackState && typeof input.mediaTrackState === "object"
          ? input.mediaTrackState
          : {},
      brb_until: eventType === "brb_start" ? brbUntil : null,
      access_session_id: accessSession?.id ?? null,
      daily_participant_state: dailyState,
      billing_media_class: billingMediaClass,
    })
    .select("id")
    .single();

  if (eventInsert.error) throw new Error(eventInsert.error.message);

  const statePatch = {
    room_id: roomId,
    user_id: input.userId,
    access_session_id: accessSession?.id ?? previous?.access_session_id ?? null,
    presence_mode: mode,
    presence_status: status,
    last_event_type: eventType,
    last_heartbeat_at:
      eventType === "heartbeat" ? nowIso : previous?.last_heartbeat_at ?? null,
    last_visible_at:
      eventType === "visible" || eventType === "selected"
        ? nowIso
        : previous?.last_visible_at ?? null,
    last_hidden_at:
      eventType === "hidden" ? nowIso : previous?.last_hidden_at ?? null,
    audio_track_state: audioState,
    video_track_state: videoState,
    screen_track_state: screenState,
    daily_participant_state: dailyState,
    billing_media_class: stateBillingMediaClass,
    brb_started_at:
      eventType === "brb_start" ? nowIso : previous?.brb_started_at ?? null,
    brb_until:
      eventType === "brb_start"
        ? brbUntil
        : eventType === "brb_end"
          ? null
          : previous?.brb_until ?? null,
    brb_returned_at:
      eventType === "brb_end" ? nowIso : previous?.brb_returned_at ?? null,
    extension_confirmed_at:
      eventType === "extension_confirmed"
        ? nowIso
        : previous?.extension_confirmed_at ?? null,
    last_presence_at: eventType === "left" ? previous?.last_presence_at ?? nowIso : nowIso,
    connected_at:
      connected && !previous?.connected_at
        ? nowIso
        : previous?.connected_at ?? null,
    disconnected_at:
      !connected && dailyState === "left"
        ? nowIso
        : previous?.disconnected_at ?? null,
    updated_at: nowIso,
  };

  const stateResult = await supabaseAdmin
    .from("room_member_presence_state")
    .upsert(statePatch, { onConflict: "room_id,user_id" })
    .select("*")
    .single();

  if (stateResult.error) throw new Error(stateResult.error.message);

  if (eventType !== "left") {
    await supabaseAdmin
      .from("rooms")
      .update({ last_presence_at: nowIso })
      .eq("id", roomId);
  }

  if (accessSession?.id) {
    const sessionPatch: Record<string, unknown> = {
      last_presence_at: eventType === "left" ? null : nowIso,
      updated_at: nowIso,
    };
    if (dailyState === "joined") {
      sessionPatch.join_confirmed_at =
        accessSession.join_confirmed_at || nowIso;
    }

    await supabaseAdmin
      .from("room_access_sessions")
      .update(sessionPatch)
      .eq("id", accessSession.id)
      .eq("room_id", roomId)
      .eq("user_id", input.userId);

    if (connected || explicitlyDisconnected) {
      const usageResult = await supabaseAdmin.rpc(
        "cowork_apply_presence_usage",
        {
          p_access_session_id: accessSession.id,
          p_delta_seconds: deltaSeconds,
          p_interval_media_class: intervalMediaClass,
          p_current_media_class: billingMediaClass,
          p_screen_share_on: intervalScreenShareOn,
          p_connected: connected,
        },
      );

      if (usageResult.error) {
        throw new Error(
          `Presence usage RPC failed: ${usageResult.error.message}`,
        );
      }
    }
  }

  let extensionConfirmation: any = null;
  if (eventType === "extension_confirmed") {
    extensionConfirmation = await writeExtensionConfirmation({
      room,
      userId: input.userId,
      accessSessionId: accessSession?.id ?? null,
      decision: input.extensionDecision === "leave" ? "leave" : "continue",
    });
  }

  if (dailyState === "left" && eventType !== "left") {
    await ensureReliabilityEvent({
      userId: input.userId,
      roomId,
      eventType: "daily_disconnected_without_explicit_leave",
      severity: "low",
      metadata: {
        access_session_id: accessSession?.id ?? null,
        presence_mode: mode,
      },
    });
  }

  if (
    previous?.presence_status === "brb" &&
    previous?.brb_until &&
    new Date(previous.brb_until).getTime() < now.getTime() &&
    eventType !== "brb_end"
  ) {
    await ensureReliabilityEvent({
      userId: input.userId,
      roomId,
      eventType: "brb_expired_without_return",
      severity: "low",
      metadata: { brb_until: previous.brb_until },
    });
  }

  return {
    ok: true,
    event_id: eventInsert.data?.id,
    state: stateResult.data,
    extension_confirmation: extensionConfirmation,
    access_session_id: accessSession?.id ?? null,
    delta_seconds_applied: deltaSeconds,
    billing_media_class: billingMediaClass,
    build_tag: ROOM_PRESENCE_BUILD_TAG,
  };
}

export async function getRoomPresenceState(roomId: string, userId: string) {
  const room = await roomMembership(roomId, userId);
  const [statesResult, confirmationsResult] = await Promise.all([
    supabaseAdmin
      .from("room_member_presence_state")
      .select("*")
      .eq("room_id", roomId)
      .order("updated_at", { ascending: false }),
    supabaseAdmin
      .from("room_extension_confirmations")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (statesResult.error) throw new Error(statesResult.error.message);
  if (confirmationsResult.error) throw new Error(confirmationsResult.error.message);

  return {
    ok: true,
    room: {
      id: room.id,
      title: room.title,
      status: room.status,
      duration_minutes: room.duration_minutes,
      scheduled_end_at: room.scheduled_end_at,
      started_at: room.started_at,
      created_at: room.created_at,
    },
    states: statesResult.data ?? [],
    extension_confirmations: confirmationsResult.data ?? [],
    commercial_extension_finalization: "blocked_until_entitlement_wallet_and_token_refresh_are_complete",
    build_tag: ROOM_PRESENCE_BUILD_TAG,
  };
}
