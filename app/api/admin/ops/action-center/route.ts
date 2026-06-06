import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit } from "@/lib/server/adminAuth";
import { buildOpsActionCenter } from "@/lib/server/opsActionCenter";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const admin = await getAdminUserFromRequest(req);
    const payload = await buildOpsActionCenter();
    await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "admin_action_center_viewed", targetType: "ops_action_center" });
    return NextResponse.json({ ...payload, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminUserFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const title = String(body.title || "").trim().slice(0, 300);
    if (!title) return NextResponse.json({ error: "任務標題不能空白。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("ops_action_items")
      .insert({
        source_type: String(body.source_type || "manual").slice(0, 80),
        source_id: body.source_id ? String(body.source_id).slice(0, 160) : null,
        title,
        description: body.description ? String(body.description).slice(0, 3000) : null,
        category: String(body.category || "general").slice(0, 80),
        severity: body.severity || "normal",
        status: body.status || "open",
        assigned_admin_user_id: body.assigned_admin_user_id || null,
        due_at: body.due_at || null,
        metadata: { source: "admin_action_center", admin_user_id: admin.userId, ...(body.metadata || {}) },
      })
      .select("*")
      .single();

    if (error || !data) return NextResponse.json({ error: error?.message || "建立任務失敗。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });

    await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "admin_action_item_created", targetType: "ops_action_item", targetId: data.id });
    return NextResponse.json({ action_item: data, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}
