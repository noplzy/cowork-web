import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildDefaultHandle, deriveDisplayName, normalizeHandle, parseTagsInput, type ProfileVisibility } from "@/lib/socialProfile";

export const PROFILE_IDENTITY_BUILD_TAG = "profile-identity-buddies-v114-2026-06-06";

export function maskEmail(email?: string | null) {
  const raw = String(email || "").trim();
  if (!raw.includes("@")) return raw || null;
  const [name, domain] = raw.split("@");
  return `${name.slice(0, 2)}***@${domain}`;
}

export function maskPhone(phone?: string | null) {
  const raw = String(phone || "").trim();
  if (!raw) return null;
  if (raw.length <= 6) return "***";
  return `${raw.slice(0, 4)}***${raw.slice(-3)}`;
}

export async function getAuthUserAdmin(userId: string) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error) throw error;
  if (!data.user) throw new Error("AUTH_USER_NOT_FOUND");
  return data.user;
}

export async function ensureProfileForUser(user: { id: string; email?: string | null; user_metadata?: Record<string, any> | null }) {
  const existing = await supabaseAdmin.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const displayName = deriveDisplayName({ email: user.email, user_metadata: user.user_metadata ?? null });
  const inserted = await supabaseAdmin.from("profiles").insert({
    user_id: user.id,
    handle: buildDefaultHandle(user.id, displayName),
    display_name: displayName,
    avatar_url: (user.user_metadata?.avatar_url as string | undefined) || (user.user_metadata?.picture as string | undefined) || null,
    bio: null,
    tags: [],
    visibility: "public",
    accepting_friend_requests: true,
    accepting_schedule_invites: true,
    show_upcoming_schedule: true,
    is_professional_buddy: false,
  }).select("*").single();

  if (inserted.error) throw inserted.error;
  return inserted.data;
}

export async function ensurePrivateSettings(userId: string) {
  const existing = await supabaseAdmin.from("user_private_profile_settings").select("*").eq("user_id", userId).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;
  const inserted = await supabaseAdmin.from("user_private_profile_settings").insert({ user_id: userId }).select("*").single();
  if (inserted.error) throw inserted.error;
  return inserted.data;
}

export function normalizeProfilePatch(body: Record<string, unknown>) {
  const displayName = String(body.display_name ?? "").trim().slice(0, 40);
  const handle = normalizeHandle(String(body.handle ?? ""));
  const visibility = String(body.visibility ?? "public") as ProfileVisibility;
  if (!displayName) throw new Error("請填寫顯示名稱。");
  if (!handle || handle.length < 3) throw new Error("個人代號至少需要 3 個可用字元。");
  if (!["public", "members", "friends"].includes(visibility)) throw new Error("無效的公開範圍。");

  return {
    display_name: displayName,
    handle,
    bio: String(body.bio ?? "").trim().slice(0, 500) || null,
    avatar_url: String(body.avatar_url ?? "").trim().slice(0, 800) || null,
    visibility,
    tags: Array.isArray(body.tags) ? body.tags.map((item) => String(item).trim()).filter(Boolean).slice(0, 8) : parseTagsInput(String(body.tags_input ?? "")),
    accepting_friend_requests: body.accepting_friend_requests !== false,
    accepting_schedule_invites: body.accepting_schedule_invites !== false,
    show_upcoming_schedule: body.show_upcoming_schedule !== false,
    updated_at: new Date().toISOString(),
  };
}

export async function syncVerifiedIdentityBindings(input: { userId: string; email?: string | null; phone?: string | null }) {
  const now = new Date().toISOString();
  const rows = [
    input.email ? { user_id: input.userId, binding_type: "email", binding_value_masked: maskEmail(input.email), status: "verified", verified_at: now, source: "supabase_auth", metadata: {}, updated_at: now } : null,
    input.phone ? { user_id: input.userId, binding_type: "phone", binding_value_masked: maskPhone(input.phone), status: "verified", verified_at: now, source: "supabase_auth", metadata: {}, updated_at: now } : null,
  ].filter(Boolean) as any[];

  for (const row of rows) {
    const existing = await supabaseAdmin.from("user_identity_bindings").select("id").eq("user_id", row.user_id).eq("binding_type", row.binding_type).eq("binding_value_masked", row.binding_value_masked).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data?.id) await supabaseAdmin.from("user_identity_bindings").update(row).eq("id", existing.data.id);
    else await supabaseAdmin.from("user_identity_bindings").insert(row);
  }
}
