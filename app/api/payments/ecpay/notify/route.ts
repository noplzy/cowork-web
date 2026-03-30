import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getEcpayConfig,
  parseFormEncodedPayload,
  queryEcpayTradeInfo,
  verifyCheckMacValue,
} from "@/lib/ecpay";

export const runtime = "nodejs";

function textResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

function parsePaidAt(paymentDate?: string): string | null {
  if (!paymentDate) return null;
  const normalized = paymentDate.replace(/\//g, "-");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
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

  await safeInsertPaymentEvent({
    merchant_trade_no: payload.MerchantTradeNo || "UNKNOWN",
    event_type: "return_url_raw",
    raw_payload: payload,
  });

  try {
    const config = getEcpayConfig();

    if (!payload.MerchantTradeNo) {
      return textResponse("0|MISSING_MERCHANT_TRADE_NO", 400);
    }

    if (payload.MerchantID !== config.merchantId) {
      return textResponse("0|INVALID_MERCHANT", 400);
    }

    if (!verifyCheckMacValue(payload, config.hashKey, config.hashIV)) {
      await safeInsertPaymentEvent({
        merchant_trade_no: payload.MerchantTradeNo,
        event_type: "return_url_invalid_checkmac",
        raw_payload: payload,
      });
      return textResponse("0|INVALID_CHECKMAC", 400);
    }

    if (String(payload.SimulatePaid || "0") === "1") {
      await safeInsertPaymentEvent({
        merchant_trade_no: payload.MerchantTradeNo,
        event_type: "return_url_simulate_paid",
        raw_payload: payload,
      });
      return textResponse("1|OK");
    }

    const queryResult = await queryEcpayTradeInfo(payload.MerchantTradeNo, config);

    await safeInsertPaymentEvent({
      merchant_trade_no: payload.MerchantTradeNo,
      event_type: "query_trade_info_after_return",
      raw_payload: queryResult,
    });

    const { data: order, error: orderError } = await supabaseAdmin
      .from("payment_orders")
      .select("merchant_trade_no,amount,status")
      .eq("merchant_trade_no", payload.MerchantTradeNo)
      .maybeSingle();

    if (orderError || !order) {
      return textResponse("0|ORDER_NOT_FOUND", 404);
    }

    const tradeStatus = String(queryResult.TradeStatus || "");
    const tradeAmt = Number(queryResult.TradeAmt || 0);
    const paidAtIso = parsePaidAt(queryResult.PaymentDate || payload.PaymentDate);
    const providerTradeNo = String(queryResult.TradeNo || payload.TradeNo || "");

    if (tradeStatus === "1" && tradeAmt === Number(order.amount)) {
      const { error: rpcError } = await supabaseAdmin.rpc("ecpay_mark_order_paid", {
        p_merchant_trade_no: payload.MerchantTradeNo,
        p_provider_trade_no: providerTradeNo || null,
        p_paid_at: paidAtIso,
        p_provider_payload: {
          return_url_payload: payload,
          query_trade_info: queryResult,
        },
      });

      if (rpcError) {
        await safeInsertPaymentEvent({
          merchant_trade_no: payload.MerchantTradeNo,
          event_type: "mark_paid_rpc_error",
          raw_payload: { message: rpcError.message },
        });
        return textResponse("0|RPC_ERROR", 500);
      }
    } else {
      const rtnCode = String(payload.RtnCode || "");
      const isDefiniteFailure = rtnCode !== "" && rtnCode !== "1";
      const isQueryFailure = tradeStatus === "10200095";

      if (isDefiniteFailure || isQueryFailure) {
        try {
          await supabaseAdmin
            .from("payment_orders")
            .update({
              status: "failed",
              last_error: `RtnCode=${rtnCode}; TradeStatus=${tradeStatus || ""}; RtnMsg=${payload.RtnMsg || ""}`,
              provider_payload: {
                return_url_payload: payload,
                query_trade_info: queryResult,
              },
            })
            .eq("merchant_trade_no", payload.MerchantTradeNo)
            .eq("status", "pending");
        } catch {
          // intentionally swallow failure logging/update failure here
        }
      }
    }

    return textResponse("1|OK");
  } catch (error: any) {
    await safeInsertPaymentEvent({
      merchant_trade_no: payload.MerchantTradeNo || "UNKNOWN",
      event_type: "return_url_handler_exception",
      raw_payload: { message: error?.message || "unknown" },
    });
    return textResponse("0|SERVER_ERROR", 500);
  }
}
