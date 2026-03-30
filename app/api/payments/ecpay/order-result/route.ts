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

export async function POST(req: Request) {
  const rawBody = await req.text();
  const payload = parseFormEncodedPayload(rawBody);
  const merchantTradeNo = String(payload.MerchantTradeNo || "").trim();
  const origin = getOrigin(req);

  if (merchantTradeNo) {
    await supabaseAdmin
      .from("payment_events")
      .insert({
        merchant_trade_no: merchantTradeNo,
        provider: "ecpay",
        event_type: "order_result_url",
        raw_payload: payload,
      })
      .catch(() => {});
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
