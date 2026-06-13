import { NextResponse } from "next/server";
import { refundCreditCard, verifyAdapterRequest } from "@/lib/server/ecpayOfficialClient";

export const runtime = "nodejs";

const BUILD_TAG = "ecpay-refund-adapter-v116-2026-06-13";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function pick(obj: any, path: string[]) {
  let cur = obj;
  for (const key of path) cur = cur?.[key];
  return cur;
}

function firstString(...values: any[]) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function extractTradeNo(paymentOrder: any) {
  return firstString(
    paymentOrder?.provider_trade_no,
    pick(paymentOrder, ["provider_payload", "query_trade_info", "TradeNo"]),
    pick(paymentOrder, ["provider_payload", "return_url_payload", "TradeNo"]),
    pick(paymentOrder, ["provider_payload", "TradeNo"]),
  );
}

export async function GET(req: Request) {
  try {
    verifyAdapterRequest(req);
    return json({ ok: true, adapter: "refund", build_tag: BUILD_TAG });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || "unauthorized" }, error?.status || 401);
  }
}

export async function POST(req: Request) {
  try {
    verifyAdapterRequest(req);
    const payload = await req.json().catch(() => ({}));
    const refund = payload.refund_request || {};
    const order = payload.payment_order || refund.payment_orders || {};
    const merchantTradeNo = firstString(order.merchant_trade_no, refund.merchant_trade_no);
    const tradeNo = extractTradeNo(order);
    const amount = Number(refund.amount_twd || order.amount || 0);
    const action = firstString(refund.metadata?.ecpay_action, order.provider_payload?.refund_action, process.env.ECPAY_REFUND_DEFAULT_ACTION, "R") as "R" | "N" | "E" | "C";

    const result = await refundCreditCard({ merchantTradeNo, tradeNo, amount, action });
    return json({ ...result, task_id: payload.task?.id || null, build_tag: BUILD_TAG });
  } catch (error: any) {
    const message = error?.message || "refund_adapter_error";
    const status = error?.status || (/UNAUTHORIZED/.test(message) ? 401 : 500);
    return json({ status: "failed", error: message, build_tag: BUILD_TAG }, status);
  }
}
