import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseFormEncodedPayload } from "@/lib/ecpay";

export const runtime = "nodejs";

function getOrigin(req: Request): string {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return new URL(req.url).origin;
}

async function recordPaymentEvent(input: {
  merchant_trade_no: string;
  provider?: string;
  event_type: string;
  raw_payload: unknown;
}) {
  const { error } = await supabaseAdmin.from("payment_events").insert({
    merchant_trade_no: input.merchant_trade_no,
    provider: input.provider ?? "ecpay",
    event_type: input.event_type,
    raw_payload: input.raw_payload,
  });

  if (error) {
    console.error("[ECPAY_ORDER_RESULT_EVENT_INSERT_ERROR]", {
      merchantTradeNo: input.merchant_trade_no,
      eventType: input.event_type,
      message: error.message,
    });
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const payload = parseFormEncodedPayload(rawBody);
  const merchantTradeNo = String(payload.MerchantTradeNo || "").trim();
  const origin = getOrigin(req);

  console.info("[ECPAY_ORDER_RESULT_HIT]", {
    merchantTradeNo,
    rtnCode: payload.RtnCode || "",
  });

  if (merchantTradeNo) {
    await recordPaymentEvent({
      merchant_trade_no: merchantTradeNo,
      event_type: "order_result_url",
      raw_payload: payload,
    });
  }

  const redirectUrl = new URL("/checkout/result", origin);
  if (merchantTradeNo) {
    redirectUrl.searchParams.set("merchantTradeNo", merchantTradeNo);
  }
  if (payload.RtnCode) {
    redirectUrl.searchParams.set("rtnCode", payload.RtnCode);
  }
  if (payload.RtnMsg) {
    redirectUrl.searchParams.set("rtnMsg", payload.RtnMsg);
  }

  return NextResponse.redirect(redirectUrl, { status: 303 });
}
