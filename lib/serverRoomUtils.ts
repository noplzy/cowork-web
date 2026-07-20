import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCommercialEntitlementSnapshot } from "@/lib/server/commercialEntitlements";

export type AuthenticatedRequestUser = {
  userId: string;
  email: string;
  accessToken: string;
};

export function extractBearer(req: Request): string | null {
  const header =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header) return null;
  const matched = header.match(/^Bearer\s+(.+)$/i);
  return matched ? matched[1].trim() : null;
}

export async function getAuthUserFromRequest(
  req: Request,
): Promise<AuthenticatedRequestUser> {
  const accessToken = extractBearer(req);
  if (!accessToken) throw new Error("UNAUTHORIZED");

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user?.id) throw new Error("UNAUTHORIZED");

  return {
    userId: data.user.id,
    email: data.user.email || "",
    accessToken,
  };
}

export async function isVipUser(userId: string): Promise<boolean> {
  try {
    return (await getCommercialEntitlementSnapshot(userId)).roomsEntitled;
  } catch {
    return false;
  }
}

export async function areUsersFriends(userA: string, userB: string) {
  if (!userA || !userB || userA === userB) return true;
  const userLow = userA < userB ? userA : userB;
  const userHigh = userA < userB ? userB : userA;
  const { data, error } = await supabaseAdmin
    .from("friendships")
    .select("user_low,user_high")
    .eq("user_low", userLow)
    .eq("user_high", userHigh)
    .maybeSingle();
  return !error && Boolean(data);
}

export async function createDailyPrivateRoom(
  roomName: string,
): Promise<{ url: string; existed: boolean }> {
  const apiKey = process.env.DAILY_API_KEY;
  const apiBase = process.env.DAILY_API_BASE || "https://api.daily.co/v1";
  if (!apiKey) throw new Error("Missing DAILY_API_KEY");
  if (!roomName.trim()) throw new Error("Missing roomName");

  const response = await fetch(`${apiBase}/rooms`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: roomName.trim(),
      privacy: "private",
      properties: {
        max_participants: 6,
        enable_screenshare: true,
        enable_knocking: false,
        enable_video_processing_ui: true,
        start_audio_off: true,
        start_video_off: true,
      },
    }),
  });
  const json = await response.json().catch(() => ({} as any));

  if (response.status === 409) {
    const existingResponse = await fetch(
      `${apiBase}/rooms/${encodeURIComponent(roomName)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      },
    );
    const existing = await existingResponse.json().catch(() => ({} as any));
    if (existingResponse.ok && existing?.url) {
      return { url: existing.url, existed: true };
    }
    throw new Error(
      json?.info ||
        json?.error ||
        existing?.info ||
        existing?.error ||
        "Daily room already exists, but failed to fetch it",
    );
  }

  if (!response.ok) {
    throw new Error(json?.info || json?.error || "Daily create-room failed");
  }
  if (!json?.url) throw new Error("Daily created room but missing url");
  return { url: json.url, existed: false };
}
