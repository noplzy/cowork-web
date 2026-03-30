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

async function safeInsertPaymentEvent(input: {
  merchant_trade_no: string;
  provider?: string;
  event_type: string;
  raw_payload: unknown;
}) {
  try {
    await supabaseAdmin.from("payment_events").insert({
      merchant_trade_no: input.merchant_trade_no,
      provider: input.provider ?? "ecpay",
      event_type: input.event_type,
      raw_payload: input.raw_payload,
    });
  } catch {
    // intentionally swallow callback logging failures
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const payload = parseFormEncodedPayload(rawBody);
  const merchantTradeNo = String(payload.MerchantTradeNo || "").trim();
  const origin = getOrigin(req);

  if (merchantTradeNo) {
    await safeInsertPaymentEvent({
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
