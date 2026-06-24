import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_OPS_BUILD_TAG, ALL_ADMIN_PERMISSIONS, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit, type AdminRoleKey } from "@/lib/server/adminAuth";
export const runtime = "nodejs";
type Context = { params: Promise<{ assignmentId: string }> };
type PatchBody = { role_key?: AdminRoleKey; permissions?: string[]; status?: "active" | "inactive" | "revoked"; note?: string | null };
function normalizePermissions(value: unknown) { const valid = new Set<string>(ALL_ADMIN_PERMISSIONS); if (!Array.isArray(value)) return []; return Array.from(new Set(value.map((item) => String(item)).filter((item) => valid.has(item)))); }
function normalizeRole(value: unknown): AdminRoleKey | null { if (value === undefined) return null; const role = String(value || "") as AdminRoleKey; return ["owner", "ops", "support", "safety", "finance", "viewer", "custom"].includes(role) ? role : null; }
export async function PATCH(req: Request, context: Context) {
  try {
    const admin = await getAdminUserFromRequest(req, { permission: "admin.manage_roles" });
    const { assignmentId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as PatchBody;
    const existing = await supabaseAdmin.from("admin_role_assignments").select("*").eq("id", assignmentId).maybeSingle();
    if (existing.error || !existing.data) return NextResponse.json({ error: existing.error?.message || "找不到 admin role assignment。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 404 });
    if (existing.data.user_id === admin.userId && body.status && body.status !== "active") return NextResponse.json({ error: "不能停用或撤銷自己的管理員權限。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const role = normalizeRole(body.role_key); if (role) patch.role_key = role;
    if (Array.isArray(body.permissions)) patch.permissions = normalizePermissions(body.permissions);
    if (body.status && ["active", "inactive", "revoked"].includes(body.status)) { patch.status = body.status; if (body.status === "revoked") { patch.revoked_at = new Date().toISOString(); patch.revoked_by_admin_user_id = admin.userId; } }
    if (body.note !== undefined) patch.note = String(body.note || "").trim().slice(0, 2000) || null;
    if (patch.status === "active") await supabaseAdmin.from("admin_role_assignments").update({ status: "inactive", revoked_by_admin_user_id: admin.userId, revoked_at: new Date().toISOString(), updated_at: new Date().toISOString(), metadata: { reason: "replaced_by_assignment_patch" } }).eq("user_id", existing.data.user_id).eq("status", "active").neq("id", assignmentId);
    const updated = await supabaseAdmin.from("admin_role_assignments").update(patch).eq("id", assignmentId).select("*").single();
    if (updated.error || !updated.data) return NextResponse.json({ error: updated.error?.message || "更新 admin role 失敗。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "admin_role_assignment_updated", targetType: "admin_role_assignment", targetId: assignmentId, metadata: { before: { user_id: existing.data.user_id, role_key: existing.data.role_key, permissions: existing.data.permissions, status: existing.data.status }, after: { user_id: updated.data.user_id, role_key: updated.data.role_key, permissions: updated.data.permissions, status: updated.data.status } } });
    return NextResponse.json({ assignment: updated.data, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) { const res = adminErrorResponse(error); return NextResponse.json(res.body, { status: res.status }); }
}
