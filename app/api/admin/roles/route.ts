import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_OPS_BUILD_TAG, ALL_ADMIN_PERMISSIONS, ADMIN_ROLE_PRESET_PERMISSIONS, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit, type AdminRoleKey } from "@/lib/server/adminAuth";
export const runtime = "nodejs";
type CreateBody = { user_id?: string; email?: string; role_key?: AdminRoleKey; permissions?: string[]; status?: "active" | "inactive"; note?: string | null };
function normalizeRole(value: unknown): AdminRoleKey { const role = String(value || "viewer") as AdminRoleKey; return ["owner", "ops", "support", "safety", "finance", "viewer", "custom"].includes(role) ? role : "viewer"; }
function normalizePermissions(value: unknown) { const valid = new Set<string>(ALL_ADMIN_PERMISSIONS); if (!Array.isArray(value)) return []; return Array.from(new Set(value.map((item) => String(item)).filter((item) => valid.has(item)))); }
async function resolveUserId(input: { user_id?: string; email?: string }) {
  const userId = String(input.user_id || "").trim(); if (userId) return userId;
  const email = String(input.email || "").trim().toLowerCase(); if (!email) throw new Error("缺少 user_id 或 email。");
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }); if (error) throw error;
  const user = data.users.find((item) => String(item.email || "").toLowerCase() === email); if (!user) throw new Error("找不到這個 Email 對應的 Supabase 使用者。");
  return user.id;
}
export async function GET(req: Request) {
  try {
    const admin = await getAdminUserFromRequest(req, { permission: "admin.read" });
    const [assignments, presets] = await Promise.all([
      supabaseAdmin.from("admin_role_assignments").select("*").order("status", { ascending: true }).order("updated_at", { ascending: false }).limit(200),
      supabaseAdmin.from("admin_permission_presets").select("*").order("role_key", { ascending: true }),
    ]);
    const firstError = assignments.error || presets.error; if (firstError) return NextResponse.json({ error: firstError.message, build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "admin_roles_listed", targetType: "admin_role_assignments", metadata: { admin_source: admin.adminSource, role_key: admin.roleKey } });
    return NextResponse.json({ assignments: assignments.data ?? [], presets: presets.data ?? [], fallback_presets: ADMIN_ROLE_PRESET_PERMISSIONS, all_permissions: ALL_ADMIN_PERMISSIONS, current_admin: { user_id: admin.userId, email: admin.email, source: admin.adminSource, role_key: admin.roleKey, permissions: admin.permissions }, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) { const res = adminErrorResponse(error); return NextResponse.json(res.body, { status: res.status }); }
}
export async function POST(req: Request) {
  try {
    const admin = await getAdminUserFromRequest(req, { permission: "admin.manage_roles" });
    const body = (await req.json().catch(() => ({}))) as CreateBody;
    const targetUserId = await resolveUserId(body); const roleKey = normalizeRole(body.role_key); const permissions = normalizePermissions(body.permissions); const status = body.status === "inactive" ? "inactive" : "active"; const note = String(body.note || "").trim().slice(0, 2000) || null;
    if (targetUserId === admin.userId && roleKey !== "owner") return NextResponse.json({ error: "不能用這個 route 把自己的角色降級。請先指定另一位 owner。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    if (status === "active") await supabaseAdmin.from("admin_role_assignments").update({ status: "inactive", revoked_by_admin_user_id: admin.userId, revoked_at: new Date().toISOString(), updated_at: new Date().toISOString(), metadata: { reason: "replaced_by_new_active_assignment" } }).eq("user_id", targetUserId).eq("status", "active");
    const inserted = await supabaseAdmin.from("admin_role_assignments").insert({ user_id: targetUserId, role_key: roleKey, permissions, status, granted_by_admin_user_id: admin.userId, note, metadata: { source: "admin_roles_route_v115" } }).select("*").single();
    if (inserted.error || !inserted.data) return NextResponse.json({ error: inserted.error?.message || "建立 admin role 失敗。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "admin_role_assignment_created", targetType: "admin_role_assignment", targetId: inserted.data.id, metadata: { target_user_id: targetUserId, role_key: roleKey, status, permissions } });
    return NextResponse.json({ assignment: inserted.data, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) { const res = adminErrorResponse(error); return NextResponse.json(res.body, { status: res.status }); }
}
