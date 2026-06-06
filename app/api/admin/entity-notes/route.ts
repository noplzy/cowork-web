import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit } from "@/lib/server/adminAuth";
import { adminNotes } from "@/lib/server/admin360";

export const runtime = "nodejs";
const ALLOWED_TARGETS = new Set(["user", "room", "payment_order", "subscription", "refund_request", "support_ticket", "moderation_case", "host_credit"]);

export async function GET(req: Request) {
  try {
    await getAdminUserFromRequest(req);
    const url = new URL(req.url);
    const targetType = String(url.searchParams.get("target_type") || "").trim();
    const targetId = String(url.searchParams.get("target_id") || "").trim();
    if (!ALLOWED_TARGETS.has(targetType) || !targetId) return NextResponse.json({ error: "缺少或不支援 target_type / target_id。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    const notes = await adminNotes(targetType, targetId);
    return NextResponse.json({ notes: notes.data, errors: notes.error ? [notes.error] : [], build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error); return NextResponse.json(res.body, { status: res.status });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminUserFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const targetType = String(body.target_type || "").trim();
    const targetId = String(body.target_id || "").trim();
    const noteBody = String(body.body || "").trim().slice(0, 6000);
    if (!ALLOWED_TARGETS.has(targetType) || !targetId) return NextResponse.json({ error: "缺少或不支援 target_type / target_id。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    if (!noteBody) return NextResponse.json({ error: "備註內容不能空白。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    const inserted = await supabaseAdmin.from("admin_entity_notes").insert({ target_type: targetType, target_id: targetId, admin_user_id: admin.userId, body: noteBody, pinned: Boolean(body.pinned), metadata: body.metadata ?? {} }).select("*").single();
    if (inserted.error || !inserted.data) return NextResponse.json({ error: inserted.error?.message || "建立管理備註失敗。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "admin_entity_note_created", targetType, targetId, metadata: { note_id: inserted.data.id, pinned: Boolean(body.pinned) } });
    return NextResponse.json({ note: inserted.data, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) { const res = adminErrorResponse(error); return NextResponse.json(res.body, { status: res.status }); }
}
