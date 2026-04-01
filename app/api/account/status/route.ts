// app/api/account/status/route.ts
// ✅ Milestone 3: 回傳目前登入者的方案與本月剩餘額度（給 UI 顯示用）
// - 免費：每月 4 場（25m=1, 50m=2）
// - VIP：無限（UI 顯示 ∞）
//
// 注意：這個 API 只是顯示；真正的強制扣點在 /api/daily/meeting-token

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const FREE_MONTHLY_CREDITS = 4;

function extractBearer(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function getMonthStartTaipeiISO(now = new Date()): string {
  // 以 Asia/Taipei 的「每月 1 號 00:00」作為週期起點（與 /api/daily/meeting-token 一致）
  // 這裡用「UTC 時間 + 8 小時」避免 Node 端時區不一致問題。
  const tz = new Date(now.getTime() + 8 * 3600 * 1000); // shift to +08:00
  const first = new Date(Date.UTC(tz.getUTCFullYear(), tz.getUTCMonth(), 1));
  return first.toISOString().slice(0, 10);
}

async function getUserBySupabaseJwt(userJwt: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) return null;

  const authResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseAnon, Authorization: `Bearer ${userJwt}` },
  });

  if (!authResp.ok) return null;
  return (await authResp.json().catch(() => null)) as any;
}

export async function GET(req: Request) {
  try {
    const userJwt = extractBearer(req);
    if (!userJwt) {
      return NextResponse.json({ error: "Missing Authorization Bearer <supabase_access_token>" }, { status: 401 });
    }

    const user = await getUserBySupabaseJwt(userJwt);
    const userId: string | undefined = user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Invalid Supabase session token" }, { status: 401 });
    }

    const { data: ent } = await supabaseAdmin
      .from("user_entitlements")
      .select("plan,vip_until")
      .eq("user_id", userId)
      .maybeSingle();

    const plan = (ent?.plan || "free") as string;
    const vipUntil = (ent?.vip_until ?? null) as string | null;

    const isVip =
      plan === "vip" &&
      (!vipUntil || new Date(vipUntil).getTime() > Date.now());

    const monthStart = getMonthStartTaipeiISO(new Date());

    const { data: usage } = await supabaseAdmin
      .from("cowork_monthly_usage")
      .select("credits_used")
      .eq("user_id", userId)
      .eq("month_start", monthStart)
      .maybeSingle();

    const used = Number(usage?.credits_used || 0);
    const remaining = Math.max(0, FREE_MONTHLY_CREDITS - used);

    return NextResponse.json({
      user_id: userId,
      month_start: monthStart,
      plan,
      vip_until: vipUntil,
      is_vip: isVip,
      free_monthly_allowance: FREE_MONTHLY_CREDITS,
      credits_used: used,
      credits_remaining: isVip ? null : remaining,
      billing_mode: isVip ? "one_time" : "free",
      auto_renew_enabled: false,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected server error" }, { status: 500 });
  }
}
