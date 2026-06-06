import { NextResponse } from "next/server";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit } from "@/lib/server/adminAuth";
import { adminNotes, safeRows, safeSingle } from "@/lib/server/admin360";

export const runtime = "nodejs";
type Context = { params: Promise<{ orderId: string }> };

export async function GET(req: Request, context: Context) {
  try {
    const admin = await getAdminUserFromRequest(req);
    const { orderId } = await context.params;
    const order = await safeSingle("payment_orders", (q) => q.eq("id", orderId).maybeSingle());
    const merchantTradeNo = String((order.data as any)?.merchant_trade_no || "");
    const [ledger, invoices, refunds, paymentEvents, entitlementEvents, notes] = await Promise.all([
      safeRows("billing_ledger", (q) => q.eq("payment_order_id", orderId).order("occurred_at", { ascending: false }).limit(80)),
      safeRows("invoice_events", (q) => q.eq("payment_order_id", orderId).order("created_at", { ascending: false }).limit(80)),
      safeRows("refund_requests", (q) => q.eq("payment_order_id", orderId).order("created_at", { ascending: false }).limit(80)),
      merchantTradeNo ? safeRows("payment_events", (q) => q.eq("merchant_trade_no", merchantTradeNo).order("created_at", { ascending: false }).limit(120)) : Promise.resolve({ data: [], error: null }),
      safeRows("entitlement_events", (q) => q.eq("payment_order_id", orderId).order("created_at", { ascending: false }).limit(80)),
      adminNotes("payment_order", orderId),
    ]);
    await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "admin_payment_order_viewed", targetType: "payment_order", targetId: orderId });
    return NextResponse.json({ order: order.data, sections: { ledger, invoices, refunds, payment_events: paymentEvents, entitlement_events: entitlementEvents, notes }, errors: [order.error].filter(Boolean), build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) { const res = adminErrorResponse(error); return NextResponse.json(res.body, { status: res.status }); }
}
