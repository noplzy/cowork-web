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
    console.error("[ECPAY_NOTIFY_EVENT_INSERT_ERROR]", {
      merchantTradeNo: input.merchant_trade_no,
      eventType: input.event_type,
      message: error.message,
    });
  }
}

async function updatePendingOrderAsFailed(input: {
  merchantTradeNo: string;
  lastError: string;
  providerPayload: unknown;
}) {
  const { error } = await supabaseAdmin
    .from("payment_orders")
    .update({
      status: "failed",
      last_error: input.lastError,
      provider_payload: input.providerPayload,
    })
    .eq("merchant_trade_no", input.merchantTradeNo)
    .eq("status", "pending");

  if (error) {
    console.error("[ECPAY_NOTIFY_ORDER_FAIL_UPDATE_ERROR]", {
      merchantTradeNo: input.merchantTradeNo,
      message: error.message,
    });
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const payload = parseFormEncodedPayload(rawBody);
  const merchantTradeNo = payload.MerchantTradeNo || "UNKNOWN";
  const simulatePaid = String(payload.SimulatePaid || "0") === "1";

  console.info("[ECPAY_NOTIFY_HIT]", {
    merchantTradeNo,
    rtnCode: payload.RtnCode || "",
    simulatePaid,
  });

  await recordPaymentEvent({
    merchant_trade_no: merchantTradeNo,
    event_type: "return_url_raw",
    raw_payload: payload,
  });

  try {
    const config = getEcpayConfig();

    if (!payload.MerchantTradeNo) {
      return textResponse("0|MISSING_MERCHANT_TRADE_NO", 400);
    }

    if (payload.MerchantID !== config.merchantId) {
      await recordPaymentEvent({
        merchant_trade_no: payload.MerchantTradeNo,
        event_type: "return_url_invalid_merchant",
        raw_payload: payload,
      });
      return textResponse("0|INVALID_MERCHANT", 400);
    }

    if (!verifyCheckMacValue(payload, config.hashKey, config.hashIV)) {
      await recordPaymentEvent({
        merchant_trade_no: payload.MerchantTradeNo,
        event_type: "return_url_invalid_checkmac",
        raw_payload: payload,
      });
      return textResponse("0|INVALID_CHECKMAC", 400);
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("payment_orders")
      .select("merchant_trade_no,amount,status")
      .eq("merchant_trade_no", payload.MerchantTradeNo)
      .maybeSingle();

    if (orderError || !order) {
      console.error("[ECPAY_NOTIFY_ORDER_NOT_FOUND]", {
        merchantTradeNo: payload.MerchantTradeNo,
        message: orderError?.message || "missing",
      });
      return textResponse("0|ORDER_NOT_FOUND", 404);
    }

    if (simulatePaid) {
      const rtnCode = String(payload.RtnCode || "");
      const tradeAmt = Number(payload.TradeAmt || order.amount || 0);
      const paidAtIso = parsePaidAt(payload.PaymentDate);
      const providerTradeNo = String(payload.TradeNo || "");

      if (rtnCode === "1" && tradeAmt === Number(order.amount)) {
        const { error: rpcError } = await supabaseAdmin.rpc("ecpay_mark_order_paid", {
          p_merchant_trade_no: payload.MerchantTradeNo,
          p_provider_trade_no: providerTradeNo || null,
          p_paid_at: paidAtIso,
          p_provider_payload: {
            return_url_payload: payload,
            simulate_paid: true,
          },
        });

        if (rpcError) {
          await recordPaymentEvent({
            merchant_trade_no: payload.MerchantTradeNo,
            event_type: "mark_paid_rpc_error_simulate",
            raw_payload: { message: rpcError.message },
          });
          console.error("[ECPAY_NOTIFY_RPC_ERROR_SIMULATE]", {
            merchantTradeNo: payload.MerchantTradeNo,
            message: rpcError.message,
          });
          return textResponse("0|RPC_ERROR", 500);
        }

        await recordPaymentEvent({
          merchant_trade_no: payload.MerchantTradeNo,
          event_type: "return_url_simulate_marked_paid",
          raw_payload: payload,
        });

        console.info("[ECPAY_NOTIFY_SIMULATE_MARKED_PAID]", {
          merchantTradeNo: payload.MerchantTradeNo,
        });

        return textResponse("1|OK");
      }

      await updatePendingOrderAsFailed({
        merchantTradeNo: payload.MerchantTradeNo,
        lastError: `SIMULATE_RTN_FAIL rtnCode=${rtnCode}; tradeAmt=${tradeAmt}; expectedAmount=${order.amount}`,
        providerPayload: {
          return_url_payload: payload,
          simulate_paid: true,
        },
      });

      await recordPaymentEvent({
        merchant_trade_no: payload.MerchantTradeNo,
        event_type: "return_url_simulate_failed",
        raw_payload: payload,
      });

      return textResponse("1|OK");
    }

    const queryResult = await queryEcpayTradeInfo(payload.MerchantTradeNo, config);

    await recordPaymentEvent({
      merchant_trade_no: payload.MerchantTradeNo,
      event_type: "query_trade_info_after_return",
      raw_payload: queryResult,
    });

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
        await recordPaymentEvent({
          merchant_trade_no: payload.MerchantTradeNo,
          event_type: "mark_paid_rpc_error",
          raw_payload: { message: rpcError.message },
        });
        console.error("[ECPAY_NOTIFY_RPC_ERROR]", {
          merchantTradeNo: payload.MerchantTradeNo,
          message: rpcError.message,
        });
        return textResponse("0|RPC_ERROR", 500);
      }

      console.info("[ECPAY_NOTIFY_MARKED_PAID]", {
        merchantTradeNo: payload.MerchantTradeNo,
        providerTradeNo,
      });
    } else {
      const rtnCode = String(payload.RtnCode || "");
      const isDefiniteFailure = rtnCode !== "" && rtnCode !== "1";
      const isQueryFailure = tradeStatus === "10200095";

      if (isDefiniteFailure || isQueryFailure) {
        await updatePendingOrderAsFailed({
          merchantTradeNo: payload.MerchantTradeNo,
          lastError: `RtnCode=${rtnCode}; TradeStatus=${tradeStatus || ""}; RtnMsg=${payload.RtnMsg || ""}`,
          providerPayload: {
            return_url_payload: payload,
            query_trade_info: queryResult,
          },
        });

        await recordPaymentEvent({
          merchant_trade_no: payload.MerchantTradeNo,
          event_type: "return_url_marked_failed",
          raw_payload: {
            rtnCode,
            tradeStatus,
            rtnMsg: payload.RtnMsg || "",
            query_trade_info: queryResult,
          },
        });

        console.warn("[ECPAY_NOTIFY_MARKED_FAILED]", {
          merchantTradeNo: payload.MerchantTradeNo,
          rtnCode,
          tradeStatus,
        });
      }
    }

    return textResponse("1|OK");
  } catch (error: any) {
    await recordPaymentEvent({
      merchant_trade_no: merchantTradeNo,
      event_type: "return_url_handler_exception",
      raw_payload: { message: error?.message || "unknown" },
    });

    console.error("[ECPAY_NOTIFY_HANDLER_EXCEPTION]", {
      merchantTradeNo,
      message: error?.message || "unknown",
    });

    return textResponse("0|SERVER_ERROR", 500);
  }
}
