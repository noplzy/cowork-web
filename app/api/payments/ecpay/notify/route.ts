import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildExpectedCheckMacValue,
  getEcpayConfig,
  parseFormEncodedPayload,
  queryEcpayTradeInfo,
  verifyCheckMacValue,
} from "@/lib/ecpay";

export const runtime = "nodejs";

function textResponse(body: string, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

function parsePaidAt(paymentDate?: string): string | null {
  if (!paymentDate) return null;
  const normalized = paymentDate.replace(/\//g, "-");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function addDaysIso(baseIso: string | null, days: number) {
  const base = baseIso ? new Date(baseIso) : new Date();
  if (Number.isNaN(base.getTime())) return null;
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function recordPaymentEvent(input: { merchant_trade_no: string; provider?: string; event_type: string; raw_payload: unknown }) {
  const { error } = await supabaseAdmin.from("payment_events").insert({
    merchant_trade_no: input.merchant_trade_no,
    provider: input.provider ?? "ecpay",
    event_type: input.event_type,
    raw_payload: input.raw_payload,
  });

  if (error) {
    console.error("[ECPAY_NOTIFY_EVENT_INSERT_ERROR]", { merchantTradeNo: input.merchant_trade_no, eventType: input.event_type, message: error.message });
  }
}

async function updatePendingOrderAsFailed(input: { merchantTradeNo: string; lastError: string; providerPayload: unknown }) {
  const { error } = await supabaseAdmin
    .from("payment_orders")
    .update({ status: "failed", last_error: input.lastError, provider_payload: input.providerPayload })
    .eq("merchant_trade_no", input.merchantTradeNo)
    .eq("status", "pending");

  if (error) {
    console.error("[ECPAY_NOTIFY_ORDER_FAIL_UPDATE_ERROR]", { merchantTradeNo: input.merchantTradeNo, message: error.message });
  }
}

async function insertIfMissing(input: { table: string; filters: Record<string, string>; row: Record<string, unknown> }) {
  let query = supabaseAdmin.from(input.table).select("id").limit(1);
  for (const [key, value] of Object.entries(input.filters)) query = query.eq(key, value);

  const existing = await query.maybeSingle();
  if (existing.error && !/relation .* does not exist/i.test(existing.error.message)) throw existing.error;
  if (existing.data) return { inserted: false, id: existing.data.id };

  const inserted = await supabaseAdmin.from(input.table).insert(input.row).select("id").single();
  if (inserted.error) {
    if (/duplicate key/i.test(inserted.error.message)) return { inserted: false, id: null };
    if (/relation .* does not exist/i.test(inserted.error.message)) {
      console.warn("[COMMERCIAL_LEDGER_TABLE_MISSING]", { table: input.table });
      return { inserted: false, id: null, skipped: true };
    }
    throw inserted.error;
  }

  return { inserted: true, id: inserted.data?.id ?? null };
}

async function recordCommercialAccounting(input: { order: any; paidAtIso: string | null; providerTradeNo: string | null; queryResult: unknown }) {
  const order = input.order;
  if (!order?.id || !order?.user_id) return;

  const entitlement = await supabaseAdmin.from("user_entitlements").select("plan,vip_until").eq("user_id", order.user_id).maybeSingle();
  const validUntil = entitlement.data?.vip_until || addDaysIso(input.paidAtIso, Number(order.vip_days || 30));

  await insertIfMissing({
    table: "billing_ledger",
    filters: { payment_order_id: order.id, ledger_type: "payment" },
    row: {
      user_id: order.user_id,
      provider: "ecpay",
      ledger_type: "payment",
      direction: "credit",
      amount_twd: Number(order.amount || 0),
      currency: order.currency || "TWD",
      payment_order_id: order.id,
      description: order.item_name || "安感島付款",
      occurred_at: input.paidAtIso || new Date().toISOString(),
      metadata: { merchant_trade_no: order.merchant_trade_no, provider_trade_no: input.providerTradeNo },
    },
  });

  await insertIfMissing({
    table: "billing_ledger",
    filters: { payment_order_id: order.id, ledger_type: "entitlement_grant" },
    row: {
      user_id: order.user_id,
      provider: "internal",
      ledger_type: "entitlement_grant",
      direction: "none",
      amount_twd: 0,
      currency: "TWD",
      payment_order_id: order.id,
      description: `方案權益開通：${order.plan_code}`,
      occurred_at: input.paidAtIso || new Date().toISOString(),
      metadata: { plan_code: order.plan_code, vip_days: order.vip_days, valid_until: validUntil },
    },
  });

  await insertIfMissing({
    table: "entitlement_events",
    filters: { payment_order_id: order.id, event_type: "grant" },
    row: {
      user_id: order.user_id,
      event_type: "grant",
      plan_code: order.plan_code,
      entitlement_key: "vip",
      quantity: 1,
      valid_from: input.paidAtIso || new Date().toISOString(),
      valid_until: validUntil,
      payment_order_id: order.id,
      metadata: { merchant_trade_no: order.merchant_trade_no, provider_trade_no: input.providerTradeNo },
    },
  });

  await insertIfMissing({
    table: "invoice_events",
    filters: { payment_order_id: order.id, event_type: "requested" },
    row: {
      user_id: order.user_id,
      payment_order_id: order.id,
      provider: "ecpay_invoice",
      event_type: "requested",
      metadata: {
        merchant_trade_no: order.merchant_trade_no,
        item_name: order.item_name,
        amount: order.amount,
        note: "付款已成立，待電子發票流程開立或同步。",
      },
    },
  });

  await recordPaymentEvent({
    merchant_trade_no: order.merchant_trade_no,
    event_type: "commercial_accounting_recorded",
    raw_payload: { order_id: order.id, user_id: order.user_id, provider_trade_no: input.providerTradeNo, valid_until: validUntil, query_trade_info: input.queryResult },
  });
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const payload = parseFormEncodedPayload(rawBody);
  const merchantTradeNo = payload.MerchantTradeNo || "UNKNOWN";
  const simulatePaid = String(payload.SimulatePaid || "0") === "1";

  console.info("[ECPAY_NOTIFY_HIT]", { merchantTradeNo, rtnCode: payload.RtnCode || "", simulatePaid });

  await recordPaymentEvent({ merchant_trade_no: merchantTradeNo, event_type: "return_url_raw", raw_payload: payload });

  try {
    const config = getEcpayConfig();

    if (!payload.MerchantTradeNo) return textResponse("0|MISSING_MERCHANT_TRADE_NO", 400);

    if (config.stage && simulatePaid) {
      const { data: existingOrder, error: existingOrderError } = await supabaseAdmin
        .from("payment_orders")
        .select("merchant_trade_no,status")
        .eq("merchant_trade_no", payload.MerchantTradeNo)
        .maybeSingle();

      const localOrderExists = !!existingOrder && !existingOrderError;

      await recordPaymentEvent({
        merchant_trade_no: payload.MerchantTradeNo,
        event_type: localOrderExists ? "return_url_simulate_paid_ack_with_local_order" : "return_url_simulate_paid_ack_without_local_order",
        raw_payload: { payload, localOrderExists, localOrderError: existingOrderError?.message || null },
      });

      console.info("[ECPAY_NOTIFY_SIMULATE_ACK]", { merchantTradeNo: payload.MerchantTradeNo, localOrderExists });
      return textResponse("1|OK");
    }

    if (payload.MerchantID !== config.merchantId) {
      await recordPaymentEvent({ merchant_trade_no: payload.MerchantTradeNo, event_type: "return_url_invalid_merchant", raw_payload: payload });
      return textResponse("0|INVALID_MERCHANT", 400);
    }

    const expectedCheckMacValue = buildExpectedCheckMacValue(payload, config.hashKey, config.hashIV);
    if (!verifyCheckMacValue(payload, config.hashKey, config.hashIV)) {
      await recordPaymentEvent({
        merchant_trade_no: payload.MerchantTradeNo,
        event_type: "return_url_invalid_checkmac",
        raw_payload: { payload, providedCheckMacValue: payload.CheckMacValue || null, expectedCheckMacValue },
      });
      console.error("[ECPAY_NOTIFY_INVALID_CHECKMAC]", { merchantTradeNo: payload.MerchantTradeNo, providedCheckMacValue: payload.CheckMacValue || null, expectedCheckMacValue });
      return textResponse("0|INVALID_CHECKMAC", 400);
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("payment_orders")
      .select("id,user_id,merchant_trade_no,amount,currency,status,plan_code,item_name,trade_desc,vip_days")
      .eq("merchant_trade_no", payload.MerchantTradeNo)
      .maybeSingle();

    if (orderError || !order) {
      console.error("[ECPAY_NOTIFY_ORDER_NOT_FOUND]", { merchantTradeNo: payload.MerchantTradeNo, message: orderError?.message || "missing" });
      await recordPaymentEvent({ merchant_trade_no: payload.MerchantTradeNo, event_type: "return_url_order_not_found", raw_payload: { payload, orderError: orderError?.message || null } });
      return textResponse("0|ORDER_NOT_FOUND", 404);
    }

    const queryResult = await queryEcpayTradeInfo(payload.MerchantTradeNo, config);
    await recordPaymentEvent({ merchant_trade_no: payload.MerchantTradeNo, event_type: "query_trade_info_after_return", raw_payload: queryResult });

    const tradeStatus = String(queryResult.TradeStatus || "");
    const tradeAmt = Number(queryResult.TradeAmt || 0);
    const paidAtIso = parsePaidAt(queryResult.PaymentDate || payload.PaymentDate);
    const providerTradeNo = String(queryResult.TradeNo || payload.TradeNo || "");

    if (tradeStatus === "1" && tradeAmt === Number(order.amount)) {
      const { error: rpcError } = await supabaseAdmin.rpc("ecpay_mark_order_paid", {
        p_merchant_trade_no: payload.MerchantTradeNo,
        p_provider_trade_no: providerTradeNo || null,
        p_paid_at: paidAtIso,
        p_provider_payload: { return_url_payload: payload, query_trade_info: queryResult },
      });

      if (rpcError) {
        await recordPaymentEvent({ merchant_trade_no: payload.MerchantTradeNo, event_type: "mark_paid_rpc_error", raw_payload: { message: rpcError.message } });
        console.error("[ECPAY_NOTIFY_RPC_ERROR]", { merchantTradeNo: payload.MerchantTradeNo, message: rpcError.message });
        return textResponse("0|RPC_ERROR", 500);
      }

      await recordCommercialAccounting({ order, paidAtIso, providerTradeNo: providerTradeNo || null, queryResult });

      await recordPaymentEvent({
        merchant_trade_no: payload.MerchantTradeNo,
        event_type: "return_url_marked_paid",
        raw_payload: { providerTradeNo, tradeStatus, tradeAmt, paidAtIso },
      });

      console.info("[ECPAY_NOTIFY_MARKED_PAID]", { merchantTradeNo: payload.MerchantTradeNo, providerTradeNo });
    } else {
      const rtnCode = String(payload.RtnCode || "");
      const isDefiniteFailure = rtnCode !== "" && rtnCode !== "1";
      const isQueryFailure = tradeStatus === "10200095";

      if (isDefiniteFailure || isQueryFailure) {
        await updatePendingOrderAsFailed({
          merchantTradeNo: payload.MerchantTradeNo,
          lastError: `RtnCode=${rtnCode}; TradeStatus=${tradeStatus || ""}; RtnMsg=${payload.RtnMsg || ""}`,
          providerPayload: { return_url_payload: payload, query_trade_info: queryResult },
        });

        await recordPaymentEvent({
          merchant_trade_no: payload.MerchantTradeNo,
          event_type: "return_url_marked_failed",
          raw_payload: { rtnCode, tradeStatus, rtnMsg: payload.RtnMsg || "", query_trade_info: queryResult },
        });

        console.warn("[ECPAY_NOTIFY_MARKED_FAILED]", { merchantTradeNo: payload.MerchantTradeNo, rtnCode, tradeStatus });
      }
    }

    return textResponse("1|OK");
  } catch (error: any) {
    await recordPaymentEvent({ merchant_trade_no: merchantTradeNo, event_type: "return_url_handler_exception", raw_payload: { message: error?.message || "unknown" } });
    console.error("[ECPAY_NOTIFY_HANDLER_EXCEPTION]", { merchantTradeNo, message: error?.message || "unknown" });
    return textResponse("0|SERVER_ERROR", 500);
  }
}
