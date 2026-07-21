import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildExpectedCheckMacValue,
  getEcpayConfig,
  parseFormEncodedPayload,
  queryEcpayTradeInfo,
  verifyCheckMacValue,
} from "@/lib/ecpay";
import { applyBuddyPayment } from "@/lib/server/buddySettlement";
import { P3_BUILD_TAGS } from "@/lib/p3Status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function paidAt(value?: string) {
  if (!value) return null;
  const date = new Date(value.replace(/\//g, "-"));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function event(
  merchantTradeNo: string,
  eventType: string,
  payload: unknown,
) {
  const result = await supabaseAdmin.from("payment_events").insert({
    merchant_trade_no: merchantTradeNo,
    provider: "ecpay",
    event_type: eventType,
    raw_payload: payload,
  });
  if (result.error) {
    console.warn("[P3_BUDDY_PAYMENT_EVENT_FAILED]", {
      merchantTradeNo,
      eventType,
      error: result.error.message,
    });
  }
}

export async function POST(req: Request) {
  const raw = await req.text();
  const payload = parseFormEncodedPayload(raw);
  const merchantTradeNo = payload.MerchantTradeNo || "UNKNOWN";
  await event(merchantTradeNo, "buddy_return_url_raw", {
    payload,
    build_tag: P3_BUILD_TAGS.notify,
  });

  try {
    const config = getEcpayConfig();
    if (!payload.MerchantTradeNo) return text("0|MISSING_TRADE_NO", 400);
    if (payload.MerchantID !== config.merchantId) {
      return text("0|INVALID_MERCHANT", 400);
    }
    const expected = buildExpectedCheckMacValue(
      payload,
      config.hashKey,
      config.hashIV,
    );
    if (!verifyCheckMacValue(payload, config.hashKey, config.hashIV)) {
      await event(merchantTradeNo, "buddy_invalid_checkmac", {
        provided: payload.CheckMacValue || null,
        expected,
      });
      return text("0|INVALID_CHECKMAC", 400);
    }

    const orderResult = await supabaseAdmin
      .from("payment_orders")
      .select(
        "id,user_id,merchant_trade_no,amount,currency,status,plan_code,buddy_booking_id,item_name,invoice_preference,provider_payload",
      )
      .eq("merchant_trade_no", merchantTradeNo)
      .maybeSingle();
    if (orderResult.error || !orderResult.data) {
      await event(merchantTradeNo, "buddy_order_not_found", {
        error: orderResult.error?.message || null,
      });
      return text("0|ORDER_NOT_FOUND", 404);
    }
    const order = orderResult.data as any;
    if (
      order.plan_code !== "buddy_booking_payment" ||
      !order.buddy_booking_id
    ) {
      return text("0|WRONG_ORDER_TYPE", 400);
    }

    const trade = await queryEcpayTradeInfo(merchantTradeNo, config);
    await event(merchantTradeNo, "buddy_query_trade_info", trade);
    const tradeStatus = String(trade.TradeStatus || "");
    const tradeAmount = Number(trade.TradeAmt || 0);
    const providerTradeNo = String(trade.TradeNo || payload.TradeNo || "");
    const paidAtIso = paidAt(trade.PaymentDate || payload.PaymentDate);

    if (tradeStatus !== "1" || tradeAmount !== Number(order.amount)) {
      const definiteFailure =
        String(payload.RtnCode || "") !== "" && payload.RtnCode !== "1";
      if (definiteFailure || tradeStatus === "10200095") {
        await supabaseAdmin
          .from("payment_orders")
          .update({
            status: "failed",
            last_error: `RtnCode=${payload.RtnCode || ""}; TradeStatus=${tradeStatus}`,
            provider_payload: {
              ...(order.provider_payload || {}),
              return_url_payload: payload,
              query_trade_info: trade,
              build_tag: P3_BUILD_TAGS.notify,
            },
          })
          .eq("id", order.id)
          .eq("status", "pending");
        await supabaseAdmin
          .from("buddy_booking_payment_applications")
          .update({
            status: "failed",
            metadata: {
              trade_status: tradeStatus,
              rtn_code: payload.RtnCode || null,
              build_tag: P3_BUILD_TAGS.notify,
            },
          })
          .eq("payment_order_id", order.id)
          .eq("status", "pending");
      }
      return text("1|OK");
    }

    const markPaid = await supabaseAdmin.rpc("ecpay_mark_order_paid", {
      p_merchant_trade_no: merchantTradeNo,
      p_provider_trade_no: providerTradeNo || null,
      p_paid_at: paidAtIso,
      p_provider_payload: {
        ...(order.provider_payload || {}),
        return_url_payload: payload,
        query_trade_info: trade,
        build_tag: P3_BUILD_TAGS.notify,
      },
    });
    if (markPaid.error) {
      await event(merchantTradeNo, "buddy_mark_paid_rpc_error", {
        error: markPaid.error.message,
      });
      return text("0|MARK_PAID_FAILED", 500);
    }

    const applied = await applyBuddyPayment({
      paymentOrderId: order.id,
      bookingId: order.buddy_booking_id,
      buyerUserId: order.user_id,
      paidAt: paidAtIso,
      providerPayload: {
        merchant_trade_no: merchantTradeNo,
        provider_trade_no: providerTradeNo || null,
        query_trade_info: trade,
      },
    });
    const invoiceExisting = await supabaseAdmin
      .from("invoice_events")
      .select("id")
      .eq("payment_order_id", order.id)
      .eq("event_type", "requested")
      .limit(1)
      .maybeSingle();
    if (invoiceExisting.error) throw invoiceExisting.error;
    if (!invoiceExisting.data) {
      const invoice = await supabaseAdmin.from("invoice_events").insert({
        user_id: order.user_id,
        payment_order_id: order.id,
        provider: "ecpay_invoice",
        event_type: "requested",
        metadata: {
          buddy_booking_id: order.buddy_booking_id,
          item_name: order.item_name,
          amount: order.amount,
          invoice_preference:
            order.invoice_preference || order.provider_payload?.invoice_preference || null,
          build_tag: P3_BUILD_TAGS.notify,
        },
      });
      if (invoice.error) throw invoice.error;
    }
    await event(merchantTradeNo, "buddy_payment_applied", {
      application: applied,
      invoice_requested: true,
      build_tag: P3_BUILD_TAGS.notify,
    });
    return text("1|OK");
  } catch (error: any) {
    await event(merchantTradeNo, "buddy_notify_exception", {
      error: error?.message || "unknown",
      build_tag: P3_BUILD_TAGS.notify,
    });
    return text("0|SERVER_ERROR", 500);
  }
}
