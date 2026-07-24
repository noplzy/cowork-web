import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getRoomCommercialState } from "@/lib/server/commercialEntitlements";
import {
  getMonthStartTaipeiISO,
  getRoomScheduledEndAt,
} from "@/lib/server/roomInfra";
import { P4A_BUILD_TAGS } from "@/lib/p4aStatus";

const FREE_MONTHLY_CREDITS = 4;
const CURRENT_PRESENCE_MAX_AGE_MS = 90_000;

type RoomRow = {
  id: string;
  title: string;
  mode: string;
  max_size: number;
  duration_minutes: number;
  created_by: string;
  created_at: string;
  started_at?: string | null;
  scheduled_end_at?: string | null;
  ended_at?: string | null;
  status?: string | null;
  visibility?: string | null;
  invite_code?: string | null;
  room_category?: string | null;
  interaction_style?: string | null;
  daily_room_url?: string | null;
  cleanup_reason?: string | null;
};

export type RoomRelationshipState =
  | "self"
  | "friend"
  | "incoming"
  | "outgoing"
  | "blocked_by_me"
  | "unavailable"
  | "none";

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function planLabel(planCode: string) {
  const labels: Record<string, string> = {
    free: "免費方案",
    vip: "VIP",
    vip_month: "VIP 月方案",
    rooms_unlimited_299: "Rooms 無限同行",
    buddies_pro_399: "Buddies 專業",
    whole_site_599: "全站同行",
    host_999: "主理人",
  };
  return labels[planCode] || planCode || "免費方案";
}

function pairKey(left: string, right: string) {
  return left < right ? `${left}:${right}` : `${right}:${left}`;
}

function safeProfileUrl(profile: any | null) {
  if (!profile?.handle || profile.public_profile_enabled !== true) return null;
  if (!["public", "members", "friends"].includes(String(profile.profile_visibility || profile.visibility || "public"))) {
    return null;
  }
  return `/profile/${encodeURIComponent(String(profile.handle))}`;
}

function isMissingOptionalRelation(message?: string | null) {
  return /relation .* does not exist|column .* does not exist|Could not find the .* column/i.test(
    String(message || ""),
  );
}

export async function assertRoomOperationalMembership(
  roomId: string,
  viewerUserId: string,
) {
  const roomResult = await supabaseAdmin
    .from("rooms")
    .select(
      "id,title,mode,max_size,duration_minutes,created_by,created_at,started_at,scheduled_end_at,ended_at,status,visibility,invite_code,room_category,interaction_style,daily_room_url,cleanup_reason",
    )
    .eq("id", roomId)
    .maybeSingle();

  if (roomResult.error || !roomResult.data) {
    throw Object.assign(new Error("ROOM_NOT_FOUND"), { status: 404 });
  }

  const room = roomResult.data as RoomRow;
  const membersResult = await supabaseAdmin
    .from("room_members")
    .select("user_id")
    .eq("room_id", roomId);

  if (membersResult.error) throw membersResult.error;
  const memberIds = unique([
    room.created_by,
    ...(membersResult.data || []).map((row: any) => String(row.user_id || "")),
  ]);

  if (viewerUserId !== room.created_by && !memberIds.includes(viewerUserId)) {
    throw Object.assign(new Error("NOT_A_MEMBER"), { status: 403 });
  }

  return { room, memberIds };
}

export async function getRoomOperationalSnapshot(
  roomId: string,
  viewerUserId: string,
) {
  const { room, memberIds } = await assertRoomOperationalMembership(
    roomId,
    viewerUserId,
  );
  const now = new Date();
  const nowIso = now.toISOString();
  const scheduledEndAt = getRoomScheduledEndAt({
    createdAt: room.created_at,
    startedAt: room.started_at,
    scheduledEndAt: room.scheduled_end_at,
    durationMinutes: room.duration_minutes,
  });
  const remainingSeconds = scheduledEndAt
    ? Math.max(0, Math.floor((new Date(scheduledEndAt).getTime() - now.getTime()) / 1000))
    : null;

  const [
    profilesResult,
    presenceResult,
    outgoingRequestsResult,
    incomingRequestsResult,
    friendshipsLowResult,
    friendshipsHighResult,
    blocksByViewerResult,
    blocksAgainstViewerResult,
    identitiesResult,
    freeUsageResult,
    commercialResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select(
        "user_id,handle,display_name,avatar_url,bio,tags,is_professional_buddy,public_profile_enabled,profile_visibility,visibility,accepting_friend_requests",
      )
      .in("user_id", memberIds),
    supabaseAdmin
      .from("room_member_presence_state")
      .select(
        "user_id,presence_mode,presence_status,brb_until,last_presence_at,audio_track_state,video_track_state,screen_track_state,daily_participant_state",
      )
      .eq("room_id", roomId)
      .in("user_id", memberIds),
    supabaseAdmin
      .from("friend_requests")
      .select("id,requester_user_id,addressee_user_id,status,created_at,updated_at")
      .eq("requester_user_id", viewerUserId)
      .eq("status", "pending"),
    supabaseAdmin
      .from("friend_requests")
      .select("id,requester_user_id,addressee_user_id,status,created_at,updated_at")
      .eq("addressee_user_id", viewerUserId)
      .eq("status", "pending"),
    supabaseAdmin
      .from("friendships")
      .select("user_low,user_high,created_at")
      .eq("user_low", viewerUserId),
    supabaseAdmin
      .from("friendships")
      .select("user_low,user_high,created_at")
      .eq("user_high", viewerUserId),
    supabaseAdmin
      .from("user_blocks")
      .select("blocker_user_id,blocked_user_id,created_at")
      .eq("blocker_user_id", viewerUserId),
    supabaseAdmin
      .from("user_blocks")
      .select("blocker_user_id,blocked_user_id,created_at")
      .eq("blocked_user_id", viewerUserId),
    supabaseAdmin
      .from("identity_verification_requests")
      .select("user_id")
      .in("user_id", memberIds)
      .eq("review_status", "approved"),
    supabaseAdmin
      .from("cowork_monthly_usage")
      .select("credits_used")
      .eq("user_id", viewerUserId)
      .eq("month_start", getMonthStartTaipeiISO(now))
      .maybeSingle(),
    getRoomCommercialState(roomId, viewerUserId).catch((error) => ({
      entitlement: null,
      extensionGrants: [],
      serverPilotEnabled: false,
      buildTag: null,
      softError: error instanceof Error ? error.message : "commercial_state_unavailable",
    })),
  ]);

  for (const result of [profilesResult, presenceResult, outgoingRequestsResult, incomingRequestsResult, friendshipsLowResult, friendshipsHighResult, identitiesResult]) {
    if (result.error) throw result.error;
  }

  const softErrors: string[] = [];
  for (const result of [blocksByViewerResult, blocksAgainstViewerResult]) {
    if (result.error) {
      if (isMissingOptionalRelation(result.error.message)) {
        softErrors.push(result.error.message);
      } else {
        throw result.error;
      }
    }
  }
  if (freeUsageResult.error && !isMissingOptionalRelation(freeUsageResult.error.message)) {
    throw freeUsageResult.error;
  }
  if ((commercialResult as any).softError) {
    softErrors.push(String((commercialResult as any).softError));
  }

  const profileMap = new Map(
    (profilesResult.data || []).map((row: any) => [String(row.user_id), row]),
  );
  const presenceMap = new Map(
    (presenceResult.data || []).map((row: any) => [String(row.user_id), row]),
  );
  const verifiedSet = new Set(
    (identitiesResult.data || []).map((row: any) => String(row.user_id)),
  );
  const outgoingMap = new Map<string, any>(
    (outgoingRequestsResult.data || []).map((row: any) => [
      String(row.addressee_user_id),
      row,
    ]),
  );
  const incomingMap = new Map<string, any>(
    (incomingRequestsResult.data || []).map((row: any) => [
      String(row.requester_user_id),
      row,
    ]),
  );
  const friendSet = new Set<string>();
  for (const row of [
    ...(friendshipsLowResult.data || []),
    ...(friendshipsHighResult.data || []),
  ] as any[]) {
    const other =
      String(row.user_low) === viewerUserId
        ? String(row.user_high)
        : String(row.user_low);
    if (other) friendSet.add(other);
  }
  const blockedByViewerSet = new Set(
    (blocksByViewerResult.data || []).map((row: any) =>
      String(row.blocked_user_id || ""),
    ),
  );
  const blocksViewerSet = new Set(
    (blocksAgainstViewerResult.data || []).map((row: any) =>
      String(row.blocker_user_id || ""),
    ),
  );

  const members = memberIds.map((userId) => {
    const profile = profileMap.get(userId) as any | undefined;
    const presence = presenceMap.get(userId) as any | undefined;
    const lastPresenceAt = presence?.last_presence_at
      ? new Date(presence.last_presence_at).getTime()
      : 0;
    const fresh =
      Number.isFinite(lastPresenceAt) &&
      now.getTime() - lastPresenceAt <= CURRENT_PRESENCE_MAX_AGE_MS;
    const isCurrent =
      Boolean(presence) &&
      fresh &&
      ["active", "brb", "hidden"].includes(
        String(presence?.presence_status || ""),
      );

    let relationship: RoomRelationshipState = "none";
    if (userId === viewerUserId) relationship = "self";
    else if (blockedByViewerSet.has(userId)) relationship = "blocked_by_me";
    else if (blocksViewerSet.has(userId)) relationship = "unavailable";
    else if (friendSet.has(userId)) relationship = "friend";
    else if (incomingMap.has(userId)) relationship = "incoming";
    else if (outgoingMap.has(userId)) relationship = "outgoing";

    return {
      user_id: userId,
      display_name:
        String(profile?.display_name || "").trim() ||
        `同行者 ${userId.slice(0, 4)}`,
      handle: profile?.handle || null,
      avatar_url: profile?.avatar_url || null,
      public_profile_url: safeProfileUrl(profile || null),
      public_profile_enabled: Boolean(profile?.public_profile_enabled),
      accepting_friend_requests:
        profile?.accepting_friend_requests !== false,
      is_owner: userId === room.created_by,
      is_viewer: userId === viewerUserId,
      is_professional_buddy: Boolean(profile?.is_professional_buddy),
      real_name_verified: verifiedSet.has(userId),
      relationship,
      relationship_request_id:
        incomingMap.get(userId)?.id || outgoingMap.get(userId)?.id || null,
      presence: {
        is_current: isCurrent,
        mode: presence?.presence_mode || "quiet",
        status: presence?.presence_status || "not_connected",
        brb_until: presence?.brb_until || null,
        last_presence_at: presence?.last_presence_at || null,
        daily_participant_state:
          presence?.daily_participant_state || "unknown",
        audio_track_state: presence?.audio_track_state || "unknown",
        video_track_state: presence?.video_track_state || "unknown",
        screen_track_state: presence?.screen_track_state || "unknown",
      },
      pair_key: pairKey(viewerUserId, userId),
    };
  });

  members.sort((left, right) => {
    if (left.is_viewer !== right.is_viewer) return left.is_viewer ? -1 : 1;
    if (left.presence.is_current !== right.presence.is_current) {
      return left.presence.is_current ? -1 : 1;
    }
    if (left.is_owner !== right.is_owner) return left.is_owner ? -1 : 1;
    return left.display_name.localeCompare(right.display_name, "zh-Hant");
  });

  const entitlement = (commercialResult as any).entitlement || null;
  const planCode = String(entitlement?.planCode || "free");
  const creditsUsed = Math.max(0, Number(freeUsageResult.data?.credits_used || 0));
  const visualRemainingSeconds = entitlement?.visualWallet?.remaining ?? null;
  const extensionPointsRemaining = entitlement?.extensionWallet?.remaining ?? null;

  return {
    server_now: nowIso,
    room: {
      id: room.id,
      title: room.title,
      mode: room.mode,
      max_size: room.max_size,
      duration_minutes: room.duration_minutes,
      created_by: room.created_by,
      status: room.status || "active",
      visibility: room.visibility || "public",
      invite_code:
        viewerUserId === room.created_by ? room.invite_code || null : null,
      room_category: room.room_category || null,
      interaction_style: room.interaction_style || null,
      started_at: room.started_at || room.created_at,
      scheduled_end_at: scheduledEndAt,
      ended_at: room.ended_at || null,
      remaining_seconds: remainingSeconds,
      cleanup_reason: room.cleanup_reason || null,
    },
    viewer: {
      user_id: viewerUserId,
      is_owner: viewerUserId === room.created_by,
      plan_code: planCode,
      plan_label: planLabel(planCode),
      rooms_entitled: Boolean(entitlement?.roomsEntitled),
      visual_remaining_seconds:
        visualRemainingSeconds === null
          ? null
          : Math.max(0, Number(visualRemainingSeconds)),
      visual_remaining_minutes:
        visualRemainingSeconds === null
          ? null
          : Math.floor(Math.max(0, Number(visualRemainingSeconds)) / 60),
      extension_points_remaining:
        extensionPointsRemaining === null
          ? null
          : Math.max(0, Number(extensionPointsRemaining)),
      free_room_credits_remaining: Math.max(
        0,
        FREE_MONTHLY_CREDITS - creditsUsed,
      ),
      free_monthly_allowance: FREE_MONTHLY_CREDITS,
    },
    members,
    member_count: members.length,
    current_participant_count: members.filter(
      (member) => member.presence.is_current,
    ).length,
    extension: {
      grants: (commercialResult as any).extensionGrants || [],
      server_enabled: Boolean((commercialResult as any).serverPilotEnabled),
    },
    soft_errors: softErrors,
    build_tag: P4A_BUILD_TAGS.operations,
  };
}
