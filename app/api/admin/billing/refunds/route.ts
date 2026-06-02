import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit } from "@/lib/server/adminAuth";
import { cleanText } from "@/lib/server/safety";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const admin = await getAdminUserFromRequest(req);
    const url = new URL(req.url);
    const status = cleanText(url.searchParams.get("status") || "", 40);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 200);

    let query = supabaseAdmin.from("refund_requests").select("*").order("created_at", { ascending: false }).limit(limit);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message, build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });

    await writeAdminAudit(req, {
      adminUserId: admin.userId,
      actionType: "admin_refund_requests_listed",
      targetType: "refund_requests",
      metadata: { status, limit },
    });

    return NextResponse.json({ refunds: data ?? [], build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}
