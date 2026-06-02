import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { FORMAL_OPS_BUILD_TAG } from "@/lib/server/safety";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const limit = 80;

    const [orders, ledger, refunds, invoices, entitlements, entitlementEvents] = await Promise.all([
      supabaseAdmin
        .from("payment_orders")
        .select("id,merchant_trade_no,provider,plan_code,amount,currency,status,item_name,trade_desc,vip_days,provider_trade_no,paid_at,last_error,created_at,updated_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit),
      supabaseAdmin
        .from("billing_ledger")
        .select("id,provider,ledger_type,direction,amount_twd,currency,payment_order_id,buddy_booking_id,room_id,description,metadata,occurred_at,created_at")
        .eq("user_id", userId)
        .order("occurred_at", { ascending: false })
        .limit(limit),
      supabaseAdmin
        .from("refund_requests")
        .select("id,payment_order_id,support_ticket_id,amount_twd,reason_category,reason,status,provider,requested_at,reviewed_at,resolved_at,created_at,updated_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit),
      supabaseAdmin
        .from("invoice_events")
        .select("id,payment_order_id,provider,event_type,invoice_number,invoice_random_number,issued_at,metadata,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit),
      supabaseAdmin
        .from("user_entitlements")
        .select("plan,vip_until")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("entitlement_events")
        .select("id,event_type,plan_code,entitlement_key,quantity,valid_from,valid_until,payment_order_id,metadata,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit),
    ]);

    const firstError = [orders.error, ledger.error, refunds.error, invoices.error, entitlements.error, entitlementEvents.error].find(Boolean);
    if (firstError) {
      return NextResponse.json({ error: firstError.message, build_tag: FORMAL_OPS_BUILD_TAG }, { status: 400 });
    }

    return NextResponse.json({
      entitlement: entitlements.data ?? { plan: "free", vip_until: null },
      payment_orders: orders.data ?? [],
      billing_ledger: ledger.data ?? [],
      refund_requests: refunds.data ?? [],
      invoice_events: invoices.data ?? [],
      entitlement_events: entitlementEvents.data ?? [],
      build_tag: FORMAL_OPS_BUILD_TAG,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "請先登入後再查看帳務資料。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 401 });
    }
    return NextResponse.json({ error: error?.message || "讀取帳務資料失敗。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 500 });
  }
}
