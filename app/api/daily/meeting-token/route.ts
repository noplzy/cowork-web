// app/api/daily/meeting-token/route.ts
// Daily REST API: POST /meeting-tokens
// ✅ Milestone 3: Monthly credits (免費每月 4 場) + VIP 續命規則 + 25/50 時間盒
// - 免費：每月 4 場（25m=1場, 50m=2場；2人/6人房同樣計費）
// - VIP：只有一種方案（VIP = 無限續場）
// - 續命護欄：
//   * Pair 房：若「另一方」是 VIP 且仍在房內，免費方可在額度用完後繼續續場
//   * Group 房：每個人要續場都要自己是 VIP（或有免費額度）
// - Server 端強制：在發 token 前先做 entitlement + credit consume

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type ReqBody = { roomId?: string };

const FREE_MONTHLY_CREDITS = 4;

function extractBearer(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function parseRoomNameFromUrl(roomUrl: string): string {
  const u = new URL(roomUrl);
  // pathname like "/cowork_xxx/" -> "cowork_xxx"
  return u.pathname.replace(/^\/+|\/+$/g, "");
}

/**
 * 以 Asia/Taipei 的「每月 1 號 00:00」作為週期起點，回傳 month_start (YYYY-MM-DD)
 * 這裡用「UTC 時間 + 8 小時」的方式避免 Node 端時區不一致問題。
 */
function getMonthStartTaipeiISO(now = new Date()): string {
  // 以 Asia/Taipei 的「每月 1 號 00:00」作為週期起點
  const tz = new Date(now.getTime() + 8 * 3600 * 1000); // shift to +08:00
  const first = new Date(Date.UTC(tz.getUTCFullYear(), tz.getUTCMonth(), 1));
  return first.toISOString().slice(0, 10);
}

function creditCostByDuration(durationMinutes: number): number {
  // 目前只做 25/50；保留未來 75 的彈性
  if (durationMinutes >= 75) return 3;
  if (durationMinutes >= 50) return 2;
  return 1;
}

async function getVipStatus(userId: string): Promise<{ isVip: boolean; vipUntil: string | null; plan: string }> {
  const { data, error } = await supabaseAdmin
    .from("user_entitlements")
    .select("plan,vip_until")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    // entitlement 表還沒建立 / RLS 設定不對 等，都不要讓它直接爆掉（先當 free）
    return { isVip: false, vipUntil: null, plan: "free" };
  }

  const plan = (data?.plan || "free") as string;
  const vipUntil = (data?.vip_until ?? null) as string | null;

  const isVip =
    plan === "vip" &&
    (!vipUntil || new Date(vipUntil).getTime() > Date.now());

  return { isVip, vipUntil, plan };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;
    const roomId = (body?.roomId || "").trim();

    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
    }

    const dailyKey = process.env.DAILY_API_KEY;
    const dailyApiBase = process.env.DAILY_API_BASE || "https://api.daily.co/v1";
    if (!dailyKey) {
      return NextResponse.json({ error: "Missing DAILY_API_KEY" }, { status: 500 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseAnon || !serviceRole) {
      return NextResponse.json(
        { error: "Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY)" },
        { status: 500 }
      );
    }

    // 1) 驗證使用者（不要信任前端傳 user_id）
    const userJwt = extractBearer(req);
    if (!userJwt) {
      return NextResponse.json({ error: "Missing Authorization Bearer <supabase_access_token>" }, { status: 401 });
    }

    const authResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnon,
        Authorization: `Bearer ${userJwt}`,
      },
    });

    if (!authResp.ok) {
      const raw = await authResp.text().catch(() => "");
      return NextResponse.json({ error: "Invalid Supabase session token", raw }, { status: 401 });
    }

    const user = (await authResp.json().catch(() => null)) as any;
    const userId: string | undefined = user?.id;
    const email: string | undefined = user?.email;
    if (!userId) {
      return NextResponse.json({ error: "Supabase user missing id" }, { status: 401 });
    }

    // 2) 查房間 + 是否成員
    const { data: room, error: roomErr } = await supabaseAdmin
      .from("rooms")
      .select("id,created_by,duration_minutes,mode,max_size,daily_room_url")
      .eq("id", roomId)
      .single();

    if (roomErr || !room) {
      return NextResponse.json({ error: roomErr?.message || "Room not found" }, { status: 404 });
    }

    if (!room.daily_room_url) {
      return NextResponse.json({ error: "Daily room not created yet" }, { status: 409 });
    }

    const isOwner = room.created_by === userId;

    const { data: mem, error: memErr } = await supabaseAdmin
      .from("room_members")
      .select("room_id,user_id")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();

    if (memErr) {
      return NextResponse.json({ error: memErr.message }, { status: 500 });
    }

    if (!mem && !isOwner) {
      return NextResponse.json({ error: "Not a room member" }, { status: 403 });
    }

    // 3) Entitlement + Credits
    const durationMin = Number(room.duration_minutes || 25);
    const costCredits = creditCostByDuration(durationMin);

    const selfEnt = await getVipStatus(userId);
    const selfIsVip = selfEnt.isVip;

    // Pair 續命：如果自己不是 VIP & 本週額度已用完，但另一方是 VIP 且仍在房內 -> allow
    let allowedByPairVipCarry = false;

    if (!selfIsVip && room.mode === "pair") {
      const { data: members, error: m2err } = await supabaseAdmin
        .from("room_members")
        .select("user_id")
        .eq("room_id", roomId);

      if (!m2err && Array.isArray(members)) {
        const otherIds = members.map((x: any) => x.user_id).filter((id: any) => id && id !== userId);
        if (otherIds.length > 0) {
          for (const oid of otherIds) {
            const oEnt = await getVipStatus(String(oid));
            if (oEnt.isVip) {
              allowedByPairVipCarry = true;
              break;
            }
          }
        }
      }
    }

    // 3.1) 若非 VIP，且不是被 Pair VIP 續命，則要扣本週額度
    let remainingCredits: number | null = null;

    if (!selfIsVip && !allowedByPairVipCarry) {
      const weekStart = getMonthStartTaipeiISO(new Date());

      const { data: remaining, error: rpcErr } = await supabaseAdmin.rpc("cowork_try_consume_credits", {
        p_user_id: userId,
        p_month_start: weekStart,
        p_cost: costCredits,
        p_allowance: FREE_MONTHLY_CREDITS,
      });

      if (rpcErr) {
        return NextResponse.json({ error: `Credit RPC error: ${rpcErr.message}` }, { status: 500 });
      }

      const rem = Number(remaining);
      if (!Number.isFinite(rem) || rem < 0) {
        return NextResponse.json(
          {
            error: "Free monthly credits exhausted",
            code: "CREDITS_EXHAUSTED",
            allowance: FREE_MONTHLY_CREDITS,
            cost: costCredits,
          },
          { status: 402 }
        );
      }

      remainingCredits = rem;
    }

    // VIP or Pair-carry：remainingCredits 由 status API 算（這裡回 null）
    // 若你想要前端顯示「∞」，前端用 is_vip 或 allowed_by_pair_vip_carry 判斷即可。

    // 4) 產 token（時間盒：依 room.duration_minutes）
    const roomName = parseRoomNameFromUrl(room.daily_room_url);

    const now = Math.floor(Date.now() / 1000);
    // 讓 token 到期「稍微晚一點點」避免時鐘誤差（~90s）
    const durationSec = Math.max(15 * 60, durationMin * 60 + 90);
    const exp = now + durationSec;

    const userName =
      (email && email.split("@")[0]) || `u_${userId.slice(0, 8)}`;

    const tokenPayload: any = {
      properties: {
        room_name: roomName,
        exp,
        eject_at_token_exp: true,
        user_name: userName,
        is_owner: Boolean(isOwner),
        enable_screenshare: true,
      },
    };

    const dailyResp = await fetch(`${dailyApiBase}/meeting-tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${dailyKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tokenPayload),
    });

    const dailyJson = await dailyResp.json().catch(() => ({}));
    if (!dailyResp.ok) {
      return NextResponse.json(
        { error: dailyJson?.info || dailyJson?.error || "Daily create token failed", raw: dailyJson },
        { status: dailyResp.status }
      );
    }

    const token = dailyJson?.token;
    if (!token) {
      return NextResponse.json({ error: "Daily token missing in response", raw: dailyJson }, { status: 500 });
    }

    return NextResponse.json({
      token,
      exp,
      room_name: roomName,
      is_owner: Boolean(isOwner),

      // 💳 billing/entitlement for UI
      duration_minutes: durationMin,
      cost_credits: costCredits,
      free_monthly_allowance: FREE_MONTHLY_CREDITS,
      remaining_credits: remainingCredits, // null means VIP or pair-carry
      is_vip: selfIsVip,
      allowed_by_pair_vip_carry: allowedByPairVipCarry,
      plan: selfEnt.plan,
      vip_until: selfEnt.vipUntil,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
