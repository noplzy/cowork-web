import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { insertReliabilityEvent } from "@/lib/server/safety";
import { P0_BUILD_TAGS } from "@/lib/p0Status";

export const ROOM_SUMMARY_BUILD_TAG = P0_BUILD_TAGS.summary;
export const ROOM_SUMMARY_VERSION = "p0-summary-v1";

const DEFAULT_VIDEO_RATE_USD = 0.004;
const DEFAULT_AUDIO_RATE_USD = 0.00099;
const MAX_HEARTBEAT_DELTA_SECONDS = 90;

type PresenceEvent = {
  id?: string;
  user_id?: string | null;
  access_session_id?: string | null;
  presence_mode?: string | null;
  event_type?: string | null;
  media_track_state?: Record<string, unknown> | null;
  daily_participant_state?: string | null;
  billing_media_class?: string | null;
  created_at?: string | null;
};

type ParticipantAccumulator = {
  userId: string;
  accessSessionId: string | null;
  presenceMode: string;
  firstPresenceAt: string | null;
  lastPresenceAt: string | null;
  actualPresenceSeconds: number;
  visualSeconds: number;
  audioOnlySeconds: number;
  screenShareSeconds: number;
  billingMediaClass: "unknown" | "no_media" | "audio_only" | "video";
  joinedConfirmed: boolean;
  leftExplicitly: boolean;
  brbCount: number;
  hiddenCount: number;
  extensionConfirmCount: number;
};

function numericEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function timestamp(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function boolTrack(value: unknown) {
  return value === true || value === "on" || value === "playable";
}

function classifyEvent(event: PresenceEvent) {
  const media = event.media_track_state || {};
  if (
    event.billing_media_class === "video" ||
    boolTrack(media.video) ||
    boolTrack(media.screen)
  ) {
    return "video" as const;
  }
  if (event.billing_media_class === "audio_only" || boolTrack(media.audio)) {
    return "audio_only" as const;
  }
  if (event.billing_media_class === "no_media") return "no_media" as const;
  return "unknown" as const;
}

function normalizeBillingMediaClass(
  value: unknown,
): ParticipantAccumulator["billingMediaClass"] {
  if (
    value === "video" ||
    value === "audio_only" ||
    value === "no_media" ||
    value === "unknown"
  ) {
    return value;
  }
  return "unknown";
}

function isCountable(event: PresenceEvent) {
  if (event.event_type === "left" || event.event_type === "brb_start") return false;
  if (event.daily_participant_state === "left" || event.daily_participant_state === "error") {
    return false;
  }
  return true;
}

function upgradeMediaClass(
  current: ParticipantAccumulator["billingMediaClass"],
  next: ParticipantAccumulator["billingMediaClass"],
) {
  const rank = { unknown: 0, no_media: 1, audio_only: 2, video: 3 } as const;
  return rank[next] > rank[current] ? next : current;
}

function participantFromEvents(userId: string, events: PresenceEvent[]) {
  const sorted = [...events].sort(
    (a, b) => (timestamp(a.created_at) ?? 0) - (timestamp(b.created_at) ?? 0),
  );
  const accumulator: ParticipantAccumulator = {
    userId,
    accessSessionId: null,
    presenceMode: "quiet",
    firstPresenceAt: sorted[0]?.created_at ?? null,
    lastPresenceAt: sorted.at(-1)?.created_at ?? null,
    actualPresenceSeconds: 0,
    visualSeconds: 0,
    audioOnlySeconds: 0,
    screenShareSeconds: 0,
    billingMediaClass: "unknown",
    joinedConfirmed: false,
    leftExplicitly: false,
    brbCount: 0,
    hiddenCount: 0,
    extensionConfirmCount: 0,
  };

  for (let index = 0; index < sorted.length; index += 1) {
    const event = sorted[index];
    const next = sorted[index + 1];
    accumulator.accessSessionId =
      event.access_session_id || accumulator.accessSessionId;
    accumulator.presenceMode = event.presence_mode || accumulator.presenceMode;
    accumulator.joinedConfirmed ||=
      event.event_type === "selected" ||
      event.event_type === "heartbeat" ||
      event.daily_participant_state === "joined";
    accumulator.leftExplicitly ||= event.event_type === "left";
    if (event.event_type === "brb_start") accumulator.brbCount += 1;
    if (event.event_type === "hidden") accumulator.hiddenCount += 1;
    if (event.event_type === "extension_confirmed") {
      accumulator.extensionConfirmCount += 1;
    }

    const currentAt = timestamp(event.created_at);
    const nextAt = timestamp(next?.created_at);
    if (!currentAt || !nextAt || !isCountable(event)) continue;

    const deltaSeconds = Math.max(
      0,
      Math.min(
        Math.floor((nextAt - currentAt) / 1000),
        MAX_HEARTBEAT_DELTA_SECONDS,
      ),
    );
    const eventClass = classifyEvent(event);
    accumulator.billingMediaClass = upgradeMediaClass(
      accumulator.billingMediaClass,
      eventClass,
    );
    accumulator.actualPresenceSeconds += deltaSeconds;
    if (eventClass === "video") accumulator.visualSeconds += deltaSeconds;
    if (eventClass === "audio_only" || eventClass === "no_media") {
      accumulator.audioOnlySeconds += deltaSeconds;
    }
    if (boolTrack(event.media_track_state?.screen)) {
      accumulator.screenShareSeconds += deltaSeconds;
    }
  }

  return accumulator;
}

function estimatedCostUsd(input: {
  connectedSeconds: number;
  billingMediaClass: ParticipantAccumulator["billingMediaClass"];
}) {
  const videoRate = numericEnv(
    "DAILY_VIDEO_RATE_USD_PER_PARTICIPANT_MINUTE",
    DEFAULT_VIDEO_RATE_USD,
  );
  const audioRate = numericEnv(
    "DAILY_AUDIO_RATE_USD_PER_PARTICIPANT_MINUTE",
    DEFAULT_AUDIO_RATE_USD,
  );

  // Conservative provider estimate: once a session is classified as video,
  // price the whole connected session at the video rate. Unknown also uses
  // the video rate so operational dashboards do not understate cost.
  const rate =
    input.billingMediaClass === "audio_only" ||
    input.billingMediaClass === "no_media"
      ? audioRate
      : videoRate;
  return (input.connectedSeconds / 60) * rate;
}

export async function summarizeRoom(roomId: string) {
  const roomResult = await supabaseAdmin
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();
  if (roomResult.error || !roomResult.data) {
    throw new Error(roomResult.error?.message || "Room not found");
  }
  const room = roomResult.data as any;

  const [
    eventsResult,
    sessionsResult,
    reliabilityResult,
    confirmationsResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("room_presence_events")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(5000),
    supabaseAdmin
      .from("room_access_sessions")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(500),
    supabaseAdmin
      .from("reliability_events")
      .select("user_id,event_type,created_at")
      .eq("room_id", roomId)
      .limit(1000),
    supabaseAdmin
      .from("room_extension_confirmations")
      .select("user_id,decision,extension_window_key,created_at")
      .eq("room_id", roomId)
      .limit(1000),
  ]);

  if (eventsResult.error) throw new Error(eventsResult.error.message);
  if (sessionsResult.error) throw new Error(sessionsResult.error.message);
  if (reliabilityResult.error) throw new Error(reliabilityResult.error.message);
  if (confirmationsResult.error) {
    throw new Error(confirmationsResult.error.message);
  }

  const events = (eventsResult.data ?? []) as PresenceEvent[];
  const sessions = (sessionsResult.data ?? []) as any[];
  const reliability = (reliabilityResult.data ?? []) as any[];
  const confirmations = (confirmationsResult.data ?? []) as any[];
  const userIds = new Set<string>();
  for (const event of events) if (event.user_id) userIds.add(event.user_id);
  for (const session of sessions) if (session.user_id) userIds.add(session.user_id);

  const participantRows = [...userIds].map((userId) => {
    const userEvents = events.filter((event) => event.user_id === userId);
    const summary = participantFromEvents(userId, userEvents);
    const session = [...sessions]
      .reverse()
      .find((item) => item.user_id === userId);
    const reliabilityCount = reliability.filter(
      (item) => item.user_id === userId,
    ).length;

    const actualPresenceSeconds = Math.max(
      summary.actualPresenceSeconds,
      Number(session?.connected_seconds || 0),
    );
    const visualSeconds = Math.max(
      summary.visualSeconds,
      Number(session?.visual_seconds || 0),
    );
    const audioOnlySeconds = Math.max(
      summary.audioOnlySeconds,
      Number(session?.audio_only_seconds || 0),
    );
    const screenShareSeconds = Math.max(
      summary.screenShareSeconds,
      Number(session?.screen_share_seconds || 0),
    );
    const billingMediaClass = upgradeMediaClass(
      summary.billingMediaClass,
      normalizeBillingMediaClass(session?.billing_media_class),
    );

    return {
      room_id: roomId,
      user_id: userId,
      access_session_id: session?.id || summary.accessSessionId,
      presence_mode: summary.presenceMode,
      first_presence_at: summary.firstPresenceAt || session?.connected_at || session?.created_at,
      last_presence_at:
        summary.lastPresenceAt || session?.disconnected_at || session?.updated_at,
      actual_presence_seconds: actualPresenceSeconds,
      participant_minutes: Number((actualPresenceSeconds / 60).toFixed(4)),
      visual_seconds: visualSeconds,
      audio_only_seconds: audioOnlySeconds,
      screen_share_seconds: screenShareSeconds,
      billing_media_class: billingMediaClass,
      joined_confirmed:
        summary.joinedConfirmed || Boolean(session?.join_confirmed_at),
      left_explicitly: summary.leftExplicitly,
      brb_count: summary.brbCount,
      hidden_count: summary.hiddenCount,
      extension_confirm_count: summary.extensionConfirmCount,
      reliability_event_count: reliabilityCount,
      estimated_provider_cost_usd: Number(
        estimatedCostUsd({
          connectedSeconds: actualPresenceSeconds,
          billingMediaClass,
        }).toFixed(6),
      ),
      summary_version: ROOM_SUMMARY_VERSION,
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  const scheduledEndMs = timestamp(
    room.scheduled_end_at || room.ended_at,
  );
  if (
    scheduledEndMs &&
    (room.status === "ended" || room.status === "expired" || room.ended_at)
  ) {
    const extensionPromptWindowStart = scheduledEndMs - 8 * 60_000;
    for (const row of participantRows) {
      const lastPresenceMs = timestamp(row.last_presence_at);
      const wasPresentForPrompt =
        row.joined_confirmed &&
        lastPresenceMs !== null &&
        lastPresenceMs >= extensionPromptWindowStart;
      const answered = confirmations.some(
        (confirmation) => confirmation.user_id === row.user_id,
      );
      const alreadyRecorded = reliability.some(
        (item) =>
          item.user_id === row.user_id &&
          item.event_type === "extension_confirmation_missing",
      );

      if (wasPresentForPrompt && !answered && !alreadyRecorded) {
        await insertReliabilityEvent({
          userId: row.user_id,
          roomId,
          eventType: "extension_confirmation_missing",
          severity: "info",
          source: "room_summary_v128",
          metadata: {
            scheduled_end_at: room.scheduled_end_at || room.ended_at,
            grace_minutes: 3,
          },
        });
        row.reliability_event_count += 1;
      }
    }
  }

  if (participantRows.length > 0) {
    const upsertParticipants = await supabaseAdmin
      .from("room_participant_summaries")
      .upsert(participantRows, { onConflict: "room_id,user_id" });
    if (upsertParticipants.error) {
      throw new Error(upsertParticipants.error.message);
    }
  }

  const totals = participantRows.reduce(
    (acc, row) => {
      acc.presenceSeconds += Number(row.actual_presence_seconds || 0);
      acc.visualSeconds += Number(row.visual_seconds || 0);
      acc.audioOnlySeconds += Number(row.audio_only_seconds || 0);
      acc.costUsd += Number(row.estimated_provider_cost_usd || 0);
      if (row.joined_confirmed) acc.connectedCount += 1;
      return acc;
    },
    {
      presenceSeconds: 0,
      visualSeconds: 0,
      audioOnlySeconds: 0,
      costUsd: 0,
      connectedCount: 0,
    },
  );

  const summaryRow = {
    room_id: roomId,
    summary_version: ROOM_SUMMARY_VERSION,
    room_title: room.title || null,
    room_category: room.room_category || null,
    room_mode: room.mode || null,
    visibility: room.visibility || null,
    scheduled_duration_minutes: Number(room.duration_minutes || 0),
    scheduled_start_at: room.started_at || room.created_at || null,
    scheduled_end_at: room.scheduled_end_at || null,
    actual_started_at:
      participantRows
        .map((row) => timestamp(row.first_presence_at))
        .filter((value): value is number => value !== null)
        .sort((a, b) => a - b)[0]
        ? new Date(
            participantRows
              .map((row) => timestamp(row.first_presence_at))
              .filter((value): value is number => value !== null)
              .sort((a, b) => a - b)[0],
          ).toISOString()
        : room.started_at || null,
    actual_ended_at: room.ended_at || room.scheduled_end_at || null,
    end_reason: room.cleanup_reason || (room.ended_at ? "ended" : room.status),
    participant_count: participantRows.length,
    connected_participant_count: totals.connectedCount,
    total_presence_seconds: totals.presenceSeconds,
    total_participant_minutes: Number((totals.presenceSeconds / 60).toFixed(4)),
    total_visual_seconds: totals.visualSeconds,
    total_audio_only_seconds: totals.audioOnlySeconds,
    estimated_provider_cost_usd: Number(totals.costUsd.toFixed(6)),
    source_event_count: events.length,
    source_access_session_count: sessions.length,
    status: "ready",
    last_error: null,
    generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const summaryResult = await supabaseAdmin
    .from("room_session_summaries")
    .upsert(summaryRow, { onConflict: "room_id" })
    .select("*")
    .single();
  if (summaryResult.error) throw new Error(summaryResult.error.message);

  await supabaseAdmin
    .from("room_access_sessions")
    .update({
      usage_status: "reconciled",
      reconciled_at: new Date().toISOString(),
      reconciliation_source: ROOM_SUMMARY_VERSION,
      updated_at: new Date().toISOString(),
    })
    .eq("room_id", roomId);

  return {
    ok: true,
    summary: summaryResult.data,
    participants: participantRows,
    build_tag: ROOM_SUMMARY_BUILD_TAG,
  };
}

export async function summarizeEndedRooms(limit = 25) {
  const roomsResult = await supabaseAdmin
    .from("rooms")
    .select("id,status,ended_at,updated_at")
    .in("status", ["ended", "expired"])
    .order("ended_at", { ascending: false, nullsFirst: false })
    .limit(Math.max(1, Math.min(limit, 100)));

  if (roomsResult.error) throw new Error(roomsResult.error.message);

  const results: Array<Record<string, unknown>> = [];
  for (const room of roomsResult.data ?? []) {
    try {
      const summarized = await summarizeRoom(room.id);
      results.push({ room_id: room.id, ok: true, summary: summarized.summary });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ room_id: room.id, ok: false, error: message });
      await supabaseAdmin.from("room_session_summaries").upsert(
        {
          room_id: room.id,
          summary_version: ROOM_SUMMARY_VERSION,
          status: "failed",
          last_error: message,
          generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "room_id" },
      );
      await insertReliabilityEvent({
        roomId: room.id,
        eventType: "room_summary_failed",
        severity: "normal",
        source: "room_summary_v128",
        metadata: { error: message },
      });
    }
  }

  return {
    ok: results.every((item) => item.ok === true),
    processed: results.length,
    succeeded: results.filter((item) => item.ok === true).length,
    failed: results.filter((item) => item.ok !== true).length,
    results,
    build_tag: ROOM_SUMMARY_BUILD_TAG,
  };
}
