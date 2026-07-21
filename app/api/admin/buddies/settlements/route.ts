import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { P3_BUILD_TAGS } from "@/lib/p3Status";
import {
  adminErrorResponse,
  getAdminUserFromRequest,
  writeAdminAudit,
} from "@/lib/server/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const admin = await getAdminUserFromRequest(req, { permission: "billing.manage" });
    const url = new URL(req.url);
    const status = String(url.searchParams.get("status") || "all");
    const providerUserId = String(url.searchParams.get("provider_user_id") || "").trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 150), 1), 300);
    let query = supabaseAdmin
      .from("buddy_settlements")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (status !== "all") query = query.eq("status", status);
    if (providerUserId) query = query.eq("provider_user_id", providerUserId);
    const result = await query;
    if (result.error) throw result.error;

    await writeAdminAudit(req, {
      adminUserId: admin.userId,
      actionType: "admin_buddy_settlements_listed",
      targetType: "buddy_settlements",
      metadata: { status, provider_user_id: providerUserId || null, limit },
    });

    return NextResponse.json({
      settlements: result.data ?? [],
      build_tag: P3_BUILD_TAGS.settlement,
    });
  } catch (error: any) {
    const mapped = adminErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
