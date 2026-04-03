import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type AuthenticatedRequestUser = {
  userId: string;
  email: string;
  accessToken: string;
};

export function extractBearer(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export async function getAuthUserFromRequest(req: Request): Promise<AuthenticatedRequestUser> {
  const accessToken = extractBearer(req);
  if (!accessToken) {
    throw new Error("UNAUTHORIZED");
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user?.id) {
    throw new Error("UNAUTHORIZED");
  }

  return {
    userId: data.user.id,
    email: data.user.email ?? "",
    accessToken,
  };
}

export async function isVipUser(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_entitlements")
    .select("plan,vip_until")
    .eq("user_id", userId)
    .maybeSingle();

  const plan = (data?.plan ?? "free") as string;
  const vipUntil = (data?.vip_until ?? null) as string | null;

  return (
    plan === "vip" &&
    (!vipUntil || new Date(vipUntil).getTime() > Date.now())
  );
}

export async function areUsersFriends(userA: string, userB: string): Promise<boolean> {
  if (!userA || !userB || userA === userB) return true;

  const userLow = userA < userB ? userA : userB;
  const userHigh = userA < userB ? userB : userA;

  const { data, error } = await supabaseAdmin
    .from("friendships")
    .select("user_low,user_high")
    .eq("user_low", userLow)
    .eq("user_high", userHigh)
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}

export async function createDailyPrivateRoom(roomName: string): Promise<{ url: string; existed: boolean }> {
  const apiKey = process.env.DAILY_API_KEY;
  const apiBase = process.env.DAILY_API_BASE || "https://api.daily.co/v1";

  if (!apiKey) throw new Error("Missing DAILY_API_KEY");
  if (!roomName.trim()) throw new Error("Missing roomName");

  const payload = {
    name: roomName.trim(),
    privacy: "private",
    properties: {
      max_participants: 6,
      enable_screenshare: true,
      enable_knocking: false,
      enable_video_processing_ui: true,
      start_audio_off: true,
    },
  };

  const resp = await fetch(`${apiBase}/rooms`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = await resp.json().catch(() => ({} as any));

  if (resp.status === 409) {
    const getResp = await fetch(`${apiBase}/rooms/${encodeURIComponent(roomName)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    const existing = await getResp.json().catch(() => ({} as any));
    const existingUrl = existing?.url as string | undefined;
    if (getResp.ok && existingUrl) {
      return { url: existingUrl, existed: true };
    }

    throw new Error(
      json?.info ||
        json?.error ||
        existing?.info ||
        existing?.error ||
        "Daily room already exists, but failed to fetch it"
    );
  }

  if (!resp.ok) {
    throw new Error(json?.info || json?.error || "Daily create-room failed");
  }

  const url = json?.url as string | undefined;
  if (!url) throw new Error("Daily created room but missing url");
  return { url, existed: false };
}
