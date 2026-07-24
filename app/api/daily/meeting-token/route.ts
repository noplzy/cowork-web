import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  ROOM_INFRA_BUILD_TAG,
  buildBillingSessionKey,
  creditCostByDuration,
  getMonthStartTaipeiISO,
  getVipStatus,
  isRoomEndedOrExpired,
  parseDailyRoomNameFromUrl,
} from "@/lib/server/roomInfra";
import {
  identityAccessErrorResponse,
  requirePhoneVerifiedFromAccessToken,
} from "@/lib/server/identityAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROOM_TOKEN_BUILD_TAG =
  "daily-room-user-identity-v140-2026-07-24";
const FREE_MONTHLY_CREDITS = 4;
const ACCESS_SESSION_PENDING_RETRY_MS = 90_000;

type RequestBody = { roomId?: string };

type AccessSessionInput = {
  roomId: string;
  userId: string;
  dailyRoomName: string;
  billingSessionKey: string;
  durationMinutes: number;
  costCredits: number;
  entitlementSource: string;
  commercialPlanCode: string | null;
  allowedByPairVipCarry: boolean;
};

function extractBearer(req: Request): string | null {
  const header =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

async function getSupabaseUser(userJwt: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) {
    throw new Error(
      "Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)",
    );
  }

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnon,
      Authorization: `Bearer ${userJwt}`,
    },
  });

  if (!authResponse.ok) {
    const raw = await authResponse.text().catch(() => "");
    const error = new Error("Invalid Supabase session token") as Error & {
      raw?: string;
      status?: number;
    };
    error.raw = raw;
    error.status = 401;
    throw error;
  }

  return (await authResponse.json().catch(() => null)) as any;
}

async function getRoomAccessSession(input: AccessSessionInput) {
  const nowIso = new Date().toISOString();
  const insertResult = await supabaseAdmin
    .from("room_access_sessions")
    .insert({
      room_id: input.roomId,
      user_id: input.userId,
      daily_room_name: input.dailyRoomName,
      billing_session_key: input.billingSessionKey,
      duration_minutes: input.durationMinutes,
      cost_credits: input.costCredits,
      charge_status: "pending",
      entitlement_source: input.entitlementSource,
      commercial_plan_code: input.commercialPlanCode,
      allowed_by_pair_vip_carry: input.allowedByPairVipCarry,
      status: "active",
      provider_payload: {},
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("*")
    .single();

  if (!insertResult.error && insertResult.data) {
    return { session: insertResult.data as any, created: true };
  }

  const duplicate =
    insertResult.error?.code === "23505" ||
    /duplicate key|unique/i.test(insertResult.error?.message ?? "");
  if (!duplicate) {
    throw new Error(
      insertResult.error?.message || "建立 room access session 失敗。",
    );
  }

  const existingResult = await supabaseAdmin
    .from("room_access_sessions")
    .select("*")
    .eq("room_id", input.roomId)
    .eq("user_id", input.userId)
    .eq("billing_session_key", input.billingSessionKey)
    .maybeSingle();
  if (existingResult.error || !existingResult.data) {
    throw new Error(
      existingResult.error?.message || "讀取既有 room access session 失敗。",
    );
  }

  return { session: existingResult.data as any, created: false };
}

async function markAccessSession(
  id: string,
  patch: Record<string, unknown>,
) {
  const { data, error } = await supabaseAdmin
    .from("room_access_sessions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as any;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const roomId = String(body?.roomId || "").trim();
    if (!roomId) {
      return NextResponse.json(
        { error: "Missing roomId", build_tag: ROOM_TOKEN_BUILD_TAG },
        { status: 400 },
      );
    }

    const dailyKey = process.env.DAILY_API_KEY;
    const dailyApiBase =
      process.env.DAILY_API_BASE || "https://api.daily.co/v1";
    if (!dailyKey) {
      return NextResponse.json(
        { error: "Missing DAILY_API_KEY", build_tag: ROOM_TOKEN_BUILD_TAG },
        { status: 500 },
      );
    }

    const userJwt = extractBearer(req);
    if (!userJwt) {
      return NextResponse.json(
        {
          error: "Missing Authorization Bearer <supabase_access_token>",
          build_tag: ROOM_TOKEN_BUILD_TAG,
        },
        { status: 401 },
      );
    }

    const user = await getSupabaseUser(userJwt);
    const userId: string | undefined = user?.id;
    const email: string | undefined = user?.email;
    if (!userId) {
      return NextResponse.json(
        { error: "Supabase user missing id", build_tag: ROOM_TOKEN_BUILD_TAG },
        { status: 401 },
      );
    }

    await requirePhoneVerifiedFromAccessToken(userJwt);

    const { data: room, error: roomError } = await supabaseAdmin
      .from("rooms")
      .select(
        "id,created_by,created_at,duration_minutes,mode,max_size,daily_room_url,status,scheduled_end_at,ended_at",
      )
      .eq("id", roomId)
      .single();
    if (roomError || !room) {
      return NextResponse.json(
        {
          error: roomError?.message || "Room not found",
          build_tag: ROOM_TOKEN_BUILD_TAG,
        },
        { status: 404 },
      );
    }
    if (isRoomEndedOrExpired(room as any, 3)) {
      return NextResponse.json(
        {
          error: "Room has ended",
          code: "ROOM_ENDED",
          build_tag: ROOM_TOKEN_BUILD_TAG,
        },
        { status: 410 },
      );
    }
    if (!room.daily_room_url) {
      return NextResponse.json(
        {
          error: "Daily room not created yet",
          build_tag: ROOM_TOKEN_BUILD_TAG,
        },
        { status: 409 },
      );
    }

    const isOwner = room.created_by === userId;
    const memberResult = await supabaseAdmin
      .from("room_members")
      .select("room_id,user_id")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();
    if (memberResult.error) {
      return NextResponse.json(
        { error: memberResult.error.message, build_tag: ROOM_TOKEN_BUILD_TAG },
        { status: 500 },
      );
    }
    if (!memberResult.data && !isOwner) {
      return NextResponse.json(
        { error: "Not a room member", build_tag: ROOM_TOKEN_BUILD_TAG },
        { status: 403 },
      );
    }

    const durationMinutes = Number(room.duration_minutes || 25);
    const costCredits = creditCostByDuration(durationMinutes);
    const selfEntitlement = await getVipStatus(userId);
    const selfIsVip = selfEntitlement.isVip;

    let allowedByPairVipCarry = false;
    if (!selfIsVip && room.mode === "pair") {
      const membersResult = await supabaseAdmin
        .from("room_members")
        .select("user_id")
        .eq("room_id", roomId);
      if (!membersResult.error && Array.isArray(membersResult.data)) {
        for (const member of membersResult.data) {
          const otherUserId = String((member as any).user_id || "");
          if (!otherUserId || otherUserId === userId) continue;
          const otherEntitlement = await getVipStatus(otherUserId);
          if (otherEntitlement.isVip) {
            allowedByPairVipCarry = true;
            break;
          }
        }
      }
    }

    const entitlementSource = selfIsVip
      ? selfEntitlement.plan
      : allowedByPairVipCarry
        ? "pair_vip_carry"
        : "free_credits";
    const dailyRoomName = parseDailyRoomNameFromUrl(room.daily_room_url);
    if (!dailyRoomName) {
      return NextResponse.json(
        { error: "Invalid Daily room URL", build_tag: ROOM_TOKEN_BUILD_TAG },
        { status: 500 },
      );
    }

    const billingSessionKey = buildBillingSessionKey(room as any);
    let {
      session: accessSession,
      created: createdAccessSession,
    } = await getRoomAccessSession({
      roomId,
      userId,
      dailyRoomName,
      billingSessionKey,
      durationMinutes,
      costCredits,
      entitlementSource,
      commercialPlanCode:
        selfEntitlement.plan === "rooms_unlimited_299"
          ? selfEntitlement.plan
          : null,
      allowedByPairVipCarry,
    });

    const pendingAgeMs =
      Date.now() -
      new Date(accessSession.updated_at || accessSession.created_at).getTime();
    const stalePending =
      accessSession.charge_status === "pending" &&
      pendingAgeMs > ACCESS_SESSION_PENDING_RETRY_MS;
    if (
      !createdAccessSession &&
      accessSession.charge_status === "pending" &&
      !stalePending
    ) {
      return NextResponse.json(
        {
          error:
            "Room access session is still being prepared. Please retry shortly.",
          code: "ACCESS_SESSION_PENDING_RETRY",
          access_session_id: accessSession.id,
          build_tag: ROOM_TOKEN_BUILD_TAG,
        },
        { status: 409 },
      );
    }

    let remainingCredits: number | null = null;
    let chargedThisCall = false;
    if (createdAccessSession || stalePending) {
      try {
        if (!selfIsVip && !allowedByPairVipCarry) {
          const monthStart = getMonthStartTaipeiISO(new Date());
          const { data: remaining, error: rpcError } = await supabaseAdmin.rpc(
            "cowork_try_consume_credits",
            {
              p_user_id: userId,
              p_month_start: monthStart,
              p_cost: costCredits,
              p_allowance: FREE_MONTHLY_CREDITS,
            },
          );
          if (rpcError) {
            throw new Error(`Credit RPC error: ${rpcError.message}`);
          }

          const numericRemaining = Number(remaining);
          if (!Number.isFinite(numericRemaining) || numericRemaining < 0) {
            await markAccessSession(accessSession.id, {
              charge_status: "failed",
              status: "credit_failed",
              last_error: "Free monthly credits exhausted",
            });
            return NextResponse.json(
              {
                error: "Free monthly credits exhausted",
                code: "CREDITS_EXHAUSTED",
                allowance: FREE_MONTHLY_CREDITS,
                cost: costCredits,
                access_session_id: accessSession.id,
                build_tag: ROOM_TOKEN_BUILD_TAG,
              },
              { status: 402 },
            );
          }

          remainingCredits = numericRemaining;
          chargedThisCall = true;
          accessSession = await markAccessSession(accessSession.id, {
            charge_status: "charged",
            charged_at: new Date().toISOString(),
            entitlement_source: entitlementSource,
            allowed_by_pair_vip_carry: false,
            cost_credits: costCredits,
            status: "active",
            last_error: null,
          });
        } else {
          accessSession = await markAccessSession(accessSession.id, {
            charge_status: "waived",
            charged_at: new Date().toISOString(),
            entitlement_source: entitlementSource,
            allowed_by_pair_vip_carry: allowedByPairVipCarry,
            cost_credits: 0,
            status: "active",
            last_error: null,
          });
        }
      } catch (error) {
        await markAccessSession(accessSession.id, {
          charge_status: "failed",
          status: "credit_failed",
          last_error:
            error instanceof Error ? error.message : "Credit consume failed",
        }).catch(() => null);
        throw error;
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const scheduledEndSeconds = room.scheduled_end_at
      ? Math.floor(new Date(room.scheduled_end_at).getTime() / 1000)
      : now + durationMinutes * 60;
    // Token stays short-lived and follows the authoritative room end. After a
    // P2 extension, a controlled reload obtains a new token without recharging
    // because buildBillingSessionKey is stable across scheduled_end_at changes.
    const expiresAt = Math.max(now + 15 * 60, scheduledEndSeconds + 90);
    const profileResult = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle();
    const userName =
      String(profileResult.data?.display_name || "").trim() ||
      (email && email.split("@")[0]) ||
      `u_${userId.slice(0, 8)}`;

    const dailyResponse = await fetch(`${dailyApiBase}/meeting-tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${dailyKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          room_name: dailyRoomName,
          exp: expiresAt,
          eject_at_token_exp: true,
          user_name: userName,
          // P4-A invariant: Daily session identity must map back to the
          // authenticated Supabase user for roster, profile and safety actions.
          user_id: userId,
          is_owner: Boolean(isOwner),
          enable_screenshare: true,
          // P0 safety invariant: no participant sends camera or microphone
          // before selecting/confirming a Presence Mode in the custom UI.
          start_video_off: true,
          start_audio_off: true,
        },
      }),
    });
    const dailyJson = await dailyResponse.json().catch(() => ({}));

    if (!dailyResponse.ok) {
      await markAccessSession(accessSession.id, {
        status: "token_failed",
        last_error:
          dailyJson?.info || dailyJson?.error || "Daily create token failed",
        provider_payload: { daily_error: dailyJson },
      }).catch(() => null);
      return NextResponse.json(
        {
          error:
            dailyJson?.info || dailyJson?.error || "Daily create token failed",
          raw: dailyJson,
          access_session_id: accessSession.id,
          build_tag: ROOM_TOKEN_BUILD_TAG,
        },
        { status: dailyResponse.status },
      );
    }

    const token = dailyJson?.token;
    if (!token) {
      await markAccessSession(accessSession.id, {
        status: "token_failed",
        last_error: "Daily token missing in response",
        provider_payload: { daily_response: dailyJson },
      }).catch(() => null);
      return NextResponse.json(
        {
          error: "Daily token missing in response",
          raw: dailyJson,
          build_tag: ROOM_TOKEN_BUILD_TAG,
        },
        { status: 500 },
      );
    }

    accessSession = await markAccessSession(accessSession.id, {
      last_token_issued_at: new Date().toISOString(),
      token_exp: new Date(expiresAt * 1000).toISOString(),
      status: "active",
      provider_payload: {
        room_name: dailyRoomName,
        daily_user_id: userId,
        token_exp: expiresAt,
        start_video_off: true,
        start_audio_off: true,
        token_refreshed_without_recharge:
          !createdAccessSession && !stalePending,
        build_tag: ROOM_TOKEN_BUILD_TAG,
      },
      last_error: null,
    });

    return NextResponse.json({
      token,
      exp: expiresAt,
      room_name: dailyRoomName,
      daily_user_id: userId,
      is_owner: Boolean(isOwner),
      duration_minutes: durationMinutes,
      cost_credits: Number(accessSession.cost_credits ?? costCredits),
      free_monthly_allowance: FREE_MONTHLY_CREDITS,
      remaining_credits: remainingCredits,
      is_vip: selfIsVip,
      allowed_by_pair_vip_carry: allowedByPairVipCarry,
      plan: selfEntitlement.plan,
      commercial_plan_code:
        selfEntitlement.plan === "rooms_unlimited_299"
          ? selfEntitlement.plan
          : null,
      vip_until: selfEntitlement.vipUntil,
      access_session_id: accessSession.id,
      charge_status: accessSession.charge_status,
      entitlement_source: accessSession.entitlement_source,
      charged_this_call: chargedThisCall,
      token_refreshed_without_recharge:
        !createdAccessSession && !stalePending,
      billing_session_key: billingSessionKey,
      media_defaults: {
        start_video_off: true,
        start_audio_off: true,
      },
      build_tag: ROOM_TOKEN_BUILD_TAG,
      room_infra_build_tag: ROOM_INFRA_BUILD_TAG,
    });
  } catch (error: any) {
    const mapped = identityAccessErrorResponse(error, ROOM_TOKEN_BUILD_TAG);
    if (mapped) return mapped;

    const status = Number(error?.status || 500);
    return NextResponse.json(
      {
        error: error?.message || "Unexpected server error",
        raw: error?.raw,
        build_tag: ROOM_TOKEN_BUILD_TAG,
      },
      { status: status >= 400 && status < 600 ? status : 500 },
    );
  }
}
