import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit } from "@/lib/server/adminAuth";
import { cleanText } from "@/lib/server/safety";

export const runtime = "nodejs";

type CreateCaseBody = {
  source_report_id?: string | null;
  target_type?: string;
  target_user_id?: string | null;
  target_room_id?: string | null;
  severity?: string;
  summary?: string;
};

export async function GET(req: Request) {
  try {
    const admin = await getAdminUserFromRequest(req);
    const url = new URL(req.url);
    const status = cleanText(url.searchParams.get("status") || "", 40);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 200);

    let query = supabaseAdmin.from("moderation_cases").select("*").order("updated_at", { ascending: false }).limit(limit);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message, build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });

    await writeAdminAudit(req, {
      adminUserId: admin.userId,
      actionType: "admin_moderation_cases_listed",
      targetType: "moderation_cases",
      metadata: { status, limit },
    });

    return NextResponse.json({ cases: data ?? [], build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminUserFromRequest(req);
    const body = (await req.json().catch(() => ({}))) as CreateCaseBody;

    const insert = await supabaseAdmin
      .from("moderation_cases")
      .insert({
        source_report_id: body.source_report_id || null,
        target_type: cleanText(body.target_type || "other", 40),
        target_user_id: body.target_user_id || null,
        target_room_id: body.target_room_id || null,
        severity: cleanText(body.severity || "normal", 40),
        status: "open",
        summary: cleanText(body.summary, 1000),
        assigned_admin_user_id: admin.userId,
      })
      .select("*")
      .single();

    if (insert.error || !insert.data) {
      return NextResponse.json({ error: insert.error?.message || "建立 moderation case 失敗。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    }

    await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "admin_moderation_case_created", targetType: "moderation_case", targetId: insert.data.id });
    return NextResponse.json({ case: insert.data, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}
