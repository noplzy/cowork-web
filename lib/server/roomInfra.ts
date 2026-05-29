import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const ROOM_INFRA_BUILD_TAG = "p0-rooms-infra-2026-05-26";

export type RoomLifecycleStatus = "active" | "ended" | "expired" | "error";
export type RoomVisibility = "public" | "members" | "friends" | "invited";

export type RoomInfraRow = {
  id: string;
  title: string;
  duration_minutes: number;
  mode: "group" | "pair";
  max_size: number;
  created_at: string;
  created_by: string;
  daily_room_url?: string | null;
  visibility?: RoomVisibility | null;
  invite_code?: string | null;
  room_category?: string | null;
  interaction_style?: string | null;
  status?: RoomLifecycleStatus | string | null;
  started_at?: string | null;
  scheduled_end_at?: string | null;
  ended_at?: string | null;
  last_presence_at?: string | null;
  cleanup_reason?: string | null;
};

export function parseDailyRoomNameFromUrl(roomUrl?: string | null): string | null {
  if (!roomUrl) return null;
  try {
    const u = new URL(roomUrl);
    const name = u.pathname.replace(/^\/+|\/+$/g, "");
    return name || null;
  } catch {
    return null;
  }
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function safeIso(date: Date) {
  return date.toISOString();
}

export function creditCostByDuration(durationMinutes: number): number {
  if (durationMinutes >= 75) return 3;
  if (durationMinutes >= 50) return 2;
  return 1;
}

export function getMonthStartTaipeiISO(now = new Date()): string {
  const tz = new Date(now.getTime() + 8 * 3600 * 1000);
  const first = new Date(Date.UTC(tz.getUTCFullYear(), tz.getUTCMonth(), 1));
  return first.toISOString().slice(0, 10);
}

export function getRoomScheduledEndAt(input: {
  createdAt?: string | null;
  startedAt?: string | null;
  scheduledEndAt?: string | null;
  durationMinutes?: number | null;
}) {
  if (input.scheduledEndAt) return input.scheduledEndAt;

  const base = new Date(input.startedAt || input.createdAt || Date.now());
  if (Number.isNaN(base.getTime())) return null;

  const duration = Number(input.durationMinutes || 25);
  return addMinutes(base, Number.isFinite(duration) ? duration : 25).toISOString();
}

export function isRoomEndedOrExpired(room: Pick<RoomInfraRow, "status" | "ended_at" | "scheduled_end_at" | "created_at" | "duration_minutes">, graceMinutes = 3) {
  if (room.status === "ended" || room.status === "expired") return true;
  if (room.ended_at) return true;

  const scheduledEndAt = getRoomScheduledEndAt({
    createdAt: room.created_at,
    scheduledEndAt: room.scheduled_end_at,
    durationMinutes: room.duration_minutes,
  });
  if (!scheduledEndAt) return false;

  return new Date(scheduledEndAt).getTime() + graceMinutes * 60 * 1000 < Date.now();
}

export function buildBillingSessionKey(room: Pick<RoomInfraRow, "id" | "created_at" | "scheduled_end_at" | "duration_minutes">) {
  const endAt = getRoomScheduledEndAt({
    createdAt: room.created_at,
    scheduledEndAt: room.scheduled_end_at,
    durationMinutes: room.duration_minutes,
  });
  return `room:${room.id}:end:${endAt || "legacy"}`;
}

export async function getVipStatus(userId: string): Promise<{ isVip: boolean; vipUntil: string | null; plan: string }> {
  const { data, error } = await supabaseAdmin
    .from("user_entitlements")
    .select("plan,vip_until")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { isVip: false, vipUntil: null, plan: "free" };
  }

  const plan = (data?.plan || "free") as string;
  const vipUntil = (data?.vip_until ?? null) as string | null;
  const isVip = plan === "vip" && (!vipUntil || new Date(vipUntil).getTime() > Date.now());

  return { isVip, vipUntil, plan };
}

export function maskUserId(userId?: string | null) {
  if (!userId) return null;
  return `${userId.slice(0, 8)}…${userId.slice(-4)}`;
}

export function getInternalCronSecret() {
  return process.env.ROOM_CLEANUP_SECRET || process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET || "";
}

export function isInternalCronRequest(req: Request) {
  const configured = getInternalCronSecret();
  if (!configured) return false;

  const headerSecret = req.headers.get("x-cron-secret") || req.headers.get("x-internal-secret") || "";
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";

  return headerSecret === configured || bearer === configured;
}

export async function tryDeleteDailyRoom(roomName: string) {
  const dailyKey = process.env.DAILY_API_KEY;
  const dailyApiBase = process.env.DAILY_API_BASE || "https://api.daily.co/v1";

  if (!dailyKey) {
    return { ok: false, skipped: true, reason: "missing_daily_key" };
  }

  const response = await fetch(`${dailyApiBase}/rooms/${encodeURIComponent(roomName)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${dailyKey}` },
  });

  if (response.status === 404) {
    return { ok: true, skipped: false, deleted: false, reason: "already_missing" };
  }

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    return { ok: false, skipped: false, reason: raw || `daily_delete_${response.status}` };
  }

  return { ok: true, skipped: false, deleted: true };
}
