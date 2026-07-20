import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { getMonthStartTaipeiISO } from "@/lib/server/roomInfra";
import { getCommercialEntitlementSnapshot } from "@/lib/server/commercialEntitlements";
import { P2_BUILD_TAGS } from "@/lib/p2Status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FREE_MONTHLY_CREDITS = 4;

export async function GET(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const [entitlement, usage] = await Promise.all([
      getCommercialEntitlementSnapshot(userId),
      supabaseAdmin
        .from("cowork_monthly_usage")
        .select("credits_used")
        .eq("user_id", userId)
        .eq("month_start", getMonthStartTaipeiISO())
        .maybeSingle(),
    ]);
    if (usage.error) throw usage.error;

    const used = Math.max(0, Number(usage.data?.credits_used || 0));
    return NextResponse.json(
      {
        user_id: userId,
        month_start: getMonthStartTaipeiISO(),
        plan: entitlement.planCode,
        vip_until: entitlement.validUntil,
        is_vip: entitlement.roomsEntitled,
        rooms_entitled: entitlement.roomsEntitled,
        legacy_vip: entitlement.legacyVip,
        commercial_plan: entitlement.commercialPlan,
        billing_mode: entitlement.billingMode,
        auto_renew_enabled: entitlement.autoRenew,
        cancel_at_period_end: entitlement.cancelAtPeriodEnd,
        free_monthly_allowance: FREE_MONTHLY_CREDITS,
        credits_used: used,
        credits_remaining: entitlement.roomsEntitled
          ? null
          : Math.max(0, FREE_MONTHLY_CREDITS - used),
        visual_wallet: entitlement.visualWallet,
        extension_wallet: entitlement.extensionWallet,
        build_tag: P2_BUILD_TAGS.entitlement,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json(
      { error: message, build_tag: P2_BUILD_TAGS.entitlement },
      { status: message === "UNAUTHORIZED" ? 401 : 500 },
    );
  }
}
