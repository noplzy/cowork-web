import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const ADMIN_360_BUILD_TAG = "admin-360-ops-v110-2026-06-04";

type QueryFn = (query: any) => any;

export async function safeRows(table: string, build: QueryFn) {
  try {
    const result = await build(supabaseAdmin.from(table).select("*"));
    if (result.error) return { data: [], error: result.error.message };
    return { data: result.data ?? [], error: null };
  } catch (error: any) {
    return { data: [], error: error?.message || `Failed to query ${table}` };
  }
}

export async function safeSingle(table: string, build: QueryFn) {
  try {
    const result = await build(supabaseAdmin.from(table).select("*"));
    if (result.error) return { data: null, error: result.error.message };
    return { data: result.data ?? null, error: null };
  } catch (error: any) {
    return { data: null, error: error?.message || `Failed to query ${table}` };
  }
}

export async function getAuthUserSummary(userId: string) {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error) return { user: null, error: error.message };
    const user = data?.user;
    if (!user) return { user: null, error: "Auth user not found." };
    return {
      user: {
        id: user.id,
        email: user.email ?? null,
        phone: user.phone ?? null,
        created_at: user.created_at ?? null,
        updated_at: user.updated_at ?? null,
        last_sign_in_at: user.last_sign_in_at ?? null,
        app_metadata: user.app_metadata ?? {},
        user_metadata: user.user_metadata ?? {},
      },
      error: null,
    };
  } catch (error: any) {
    return { user: null, error: error?.message || "Failed to read auth user." };
  }
}

export async function listAuthUsers(q: string, limit: number) {
  const normalized = q.trim().toLowerCase();
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: Math.min(Math.max(limit, 1), 1000) });
  if (error) throw error;
  return data.users
    .filter((user) => !normalized || user.id.toLowerCase().includes(normalized) || String(user.email || "").toLowerCase().includes(normalized) || String(user.phone || "").toLowerCase().includes(normalized))
    .slice(0, limit)
    .map((user) => ({ id: user.id, email: user.email ?? null, phone: user.phone ?? null, created_at: user.created_at ?? null, last_sign_in_at: user.last_sign_in_at ?? null, user_metadata: user.user_metadata ?? {} }));
}

export async function adminNotes(targetType: string, targetId: string) {
  return safeRows("admin_entity_notes", (q) => q.eq("target_type", targetType).eq("target_id", targetId).order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(40));
}
