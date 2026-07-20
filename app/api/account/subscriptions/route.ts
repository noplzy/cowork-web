import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { getCommercialEntitlementSnapshot } from "@/lib/server/commercialEntitlements";
import { P2_BUILD_TAGS } from "@/lib/p2Status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const [profiles, events, entitlement] = await Promise.all([
      supabaseAdmin.from("subscription_profiles")
        .select("id,provider,plan_code,status,period_amount,period_type,frequency,auto_renew,next_charge_at,current_period_start,current_period_end,cancel_requested_at,cancelled_at,cancel_reason,last_provider_error,invoice_preference,commercial_entitlement_status,entitlement_applied_at,created_at,updated_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(80),
      supabaseAdmin.from("subscription_events")
        .select("id,subscription_profile_id,event_type,merchant_trade_no,payment_order_id,created_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(80),
      getCommercialEntitlementSnapshot(userId),
    ]);
    const firstError = profiles.error || events.error;
    if (firstError) throw firstError;
    return NextResponse.json({
      subscriptions: profiles.data || [],
      events: events.data || [],
      entitlement,
      build_tag: P2_BUILD_TAGS.entitlement,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "讀取訂閱資料失敗。";
    return NextResponse.json(
      { error: message, build_tag: P2_BUILD_TAGS.entitlement },
      { status: message === "UNAUTHORIZED" ? 401 : 500 },
    );
  }
}
