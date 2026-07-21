import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  P3_BUILD_TAGS,
  buddiesPayoutMode,
  isBuddiesCommercialPilotEnabled,
  isBuddiesPublicPilotEnabled,
  isBuddiesRemoteOnlyPilot,
  p3AllAttestationsAccepted,
  p3AttestationFlags,
} from "@/lib/p3Status";
import { isInternalCronRequest } from "@/lib/server/roomInfra";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isInternalCronRequest(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const requiredTables = [
    "buddy_booking_payment_applications",
    "buddy_settlements",
    "buddy_settlement_events",
    "buddy_payout_accounts",
    "buddy_payout_batches",
    "buddy_payout_items",
  ];
  const tableChecks = await Promise.all(
    requiredTables.map(async (table) => {
      const result = await supabaseAdmin.from(table).select("*").limit(0);
      return { table, ok: !result.error, error: result.error?.message || null };
    }),
  );
  const [manualReview, failedPayouts, pendingAccounts] = await Promise.all([
    supabaseAdmin.from("buddy_settlements").select("id", { count: "exact", head: true }).eq("status", "manual_review"),
    supabaseAdmin.from("buddy_payout_items").select("id", { count: "exact", head: true }).eq("status", "failed"),
    supabaseAdmin.from("buddy_payout_accounts").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
  ]);
  const flags = p3AttestationFlags();
  const checks = {
    p3_tables: tableChecks.every((item) => item.ok),
    p0_p3_attestations: p3AllAttestationsAccepted(),
    server_pilot_enabled: isBuddiesCommercialPilotEnabled(),
    public_pilot_enabled: isBuddiesPublicPilotEnabled(),
    remote_only: isBuddiesRemoteOnlyPilot(),
    payout_mode_manual_verified: buddiesPayoutMode() === "manual_verified",
    no_manual_review_settlements: (manualReview.count || 0) === 0,
    no_failed_payout_items: (failedPayouts.count || 0) === 0,
  };
  return NextResponse.json({
    ready_for_invite_trial: Object.values(checks).every(Boolean),
    checks,
    attestations: flags,
    operations: {
      pending_payout_accounts: pendingAccounts.count || 0,
      manual_review_settlements: manualReview.count || 0,
      failed_payout_items: failedPayouts.count || 0,
    },
    table_checks: tableChecks,
    build_tag: P3_BUILD_TAGS.launchGate,
  });
}
