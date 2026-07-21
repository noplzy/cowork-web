import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireBuddiesRealNameVerifiedForRequest } from "@/lib/server/identityAccess";
import { P3_BUILD_TAGS } from "@/lib/p3Status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { userId } = await requireBuddiesRealNameVerifiedForRequest(req);
    const [settlements, payoutItems, payoutAccount] = await Promise.all([
      supabaseAdmin
        .from("buddy_settlements")
        .select(
          "id,booking_id,status,gross_amount_twd,platform_fee_twd,provider_net_twd,refund_amount_twd,available_for_payout_at,paid_out_at,hold_reason,created_at,updated_at",
        )
        .eq("provider_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(120),
      supabaseAdmin
        .from("buddy_payout_items")
        .select(
          "id,batch_id,settlement_id,amount_twd,status,provider_reference,processed_at,created_at,updated_at",
        )
        .eq("provider_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(120),
      supabaseAdmin
        .from("buddy_payout_accounts")
        .select("id,status,bank_code,account_last5,verified_at,updated_at")
        .eq("provider_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (settlements.error) throw settlements.error;
    if (payoutItems.error) throw payoutItems.error;
    if (payoutAccount.error) throw payoutAccount.error;

    const rows = settlements.data ?? [];
    const sum = (statuses: string[]) =>
      rows
        .filter((row: any) => statuses.includes(row.status))
        .reduce((total: number, row: any) => total + Number(row.provider_net_twd || 0), 0);

    return NextResponse.json({
      summary: {
        held_twd: sum([
          "funds_held",
          "service_accepted",
          "completed_hold",
          "dispute_hold",
          "refund_pending",
          "manual_review",
        ]),
        releasable_twd: sum(["releasable"]),
        processing_twd: sum(["payout_processing"]),
        paid_out_twd: sum(["paid_out"]),
      },
      settlements: rows,
      payout_items: payoutItems.data ?? [],
      payout_account: payoutAccount.data ?? null,
      build_tag: P3_BUILD_TAGS.payout,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "讀取 Buddies 收益失敗。" },
      { status: Number(error?.status || 500) },
    );
  }
}
