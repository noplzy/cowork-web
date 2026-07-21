import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  P3_BUILD_TAGS,
  buddiesPayoutMode,
} from "@/lib/p3Status";
import {
  adminErrorResponse,
  getAdminUserFromRequest,
  writeAdminAudit,
} from "@/lib/server/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const admin = await getAdminUserFromRequest(req, {
      permission: "billing.manage",
    });
    const url = new URL(req.url);
    const status = String(url.searchParams.get("status") || "pending_review");
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 250);
    let query = supabaseAdmin
      .from("buddy_payout_accounts")
      .select(
        "id,provider_user_id,payout_method,bank_code,account_last5,account_holder_name,status,secure_provider_reference,verified_at,verified_by_admin_user_id,reviewer_note,metadata,created_at,updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (status !== "all") query = query.eq("status", status);
    const result = await query;
    if (result.error) throw result.error;

    await writeAdminAudit(req, {
      adminUserId: admin.userId,
      actionType: "admin_buddy_payout_accounts_listed",
      targetType: "buddy_payout_accounts",
      metadata: { status, limit },
    });

    return NextResponse.json({
      payout_accounts: result.data ?? [],
      payout_mode: buddiesPayoutMode(),
      raw_account_numbers_stored: false,
      build_tag: P3_BUILD_TAGS.payout,
    });
  } catch (error: any) {
    const mapped = adminErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
