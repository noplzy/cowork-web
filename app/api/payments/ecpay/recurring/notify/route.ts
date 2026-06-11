import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getEcpayConfig, parseFormEncodedPayload, verifyCheckMacValue } from "@/lib/ecpay";

export const runtime = "nodejs";

const RECURRING_NOTIFY_BUILD_TAG = "ecpay-recurring-notify-v115-2026-06-10";

function textResponse(body: string, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

function parsePaidAt(value?: string) {
  if (!value) return null;
  const date = new Date(value.replace(/\//g, "-"));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function addDaysIso(baseIso: string, days: number) {
  const base = new Date(baseIso);
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function recordPaymentEvent(input: { merchantTradeNo: string; eventType: string; payload: unknown }) {
  await supabaseAdmin.from("payment_events").insert({
    merchant_trade_no: input.merchantTradeNo,
    provider: "ecpay",
    event_type: input.eventType,
    raw_payload: input.payload,
  });
}

async function findExistingRecurringOrder(input: { merchantTradeNo: string; providerTradeNo: string | null }) {
  if (input.providerTradeNo) {
    const byTradeNo = await supabaseAdmin
      .from("payment_orders")
      .select("*")
      .eq("provider", "ecpay_recurring")
      .eq("provider_trade_no", input.providerTradeNo)
      .limit(1)
      .maybeSingle();
    if (byTradeNo.error) throw byTradeNo.error;
    if (byTradeNo.data) return byTradeNo.data;
  }

  const byMerchantTradeNo = await supabaseAdmin
    .from("payment_orders")
    .select("*")
    .eq("provider", "ecpay_recurring")
    .eq("merchant_trade_no", input.merchantTradeNo)
    .limit(1)
    .maybeSingle();
  if (byMerchantTradeNo.error) throw byMerchantTradeNo.error;
  return byMerchantTradeNo.data ?? null;
}

async function upsertVipEntitlement(input: { userId: string; validUntil: string }) {
  const { error } = await supabaseAdmin
    .from("user_entitlements")
    .upsert({
      user_id: input.userId,
      plan: "vip",
      vip_until: input.validUntil,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  if (error) throw error;
}

async function insertLedgerIfMissing(input: { userId: string; paymentOrderId: string | null; amount: number; paidAt: string; profileId: string; providerTradeNo: string | null }) {
  if (!input.paymentOrderId) return;
  const existing = await supabaseAdmin
    .from("billing_ledger")
    .select("id")
    .eq("payment_order_id", input.paymentOrderId)
    .eq("ledger_type", "payment")
    .limit(1)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return;

  await supabaseAdmin.from("billing_ledger").insert({
    user_id: input.userId,
    provider: "ecpay_recurring",
    ledger_type: "payment",
    direction: "credit",
    amount_twd: input.amount,
    currency: "TWD",
    payment_order_id: input.paymentOrderId,
    description: "訂閱自動扣款成功",
    occurred_at: input.paidAt,
    metadata: {
      subscription_profile_id: input.profileId,
      provider_trade_no: input.providerTradeNo,
      build_tag: RECURRING_NOTIFY_BUILD_TAG,
    },
  });
}

async function insertEntitlementEventIfMissing(input: { userId: string; paymentOrderId: string | null; profileId: string; planCode: string; paidAt: string; validUntil: string }) {
  if (!input.paymentOrderId) return;
  const existing = await supabaseAdmin
    .from("entitlement_events")
    .select("id")
    .eq("payment_order_id", input.paymentOrderId)
    .eq("event_type", "extend")
    .limit(1)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return;

  await supabaseAdmin.from("entitlement_events").insert({
    user_id: input.userId,
    event_type: "extend",
    plan_code: input.planCode,
    entitlement_key: "vip",
    quantity: 1,
    valid_from: input.paidAt,
    valid_until: input.validUntil,
    payment_order_id: input.paymentOrderId,
    metadata: {
      subscription_profile_id: input.profileId,
      build_tag: RECURRING_NOTIFY_BUILD_TAG,
    },
  });
}

async function insertInvoiceRequestIfMissing(input: { userId: string; paymentOrderId: string | null; profileId: string; itemName: string; amount: number }) {
  if (!input.paymentOrderId) return;
  const existing = await supabaseAdmin
    .from("invoice_events")
    .select("id")
    .eq("payment_order_id", input.paymentOrderId)
    .eq("event_type", "requested")
    .limit(1)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return;

  await supabaseAdmin.from("invoice_events").insert({
    user_id: input.userId,
    payment_order_id: input.paymentOrderId,
    provider: "ecpay_invoice",
    event_type: "requested",
    metadata: {
      source: "recurring_payment",
      subscription_profile_id: input.profileId,
      item_name: input.itemName,
      amount: input.amount,
      build_tag: RECURRING_NOTIFY_BUILD_TAG,
    },
  });
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const payload = parseFormEncodedPayload(rawBody);
  const merchantTradeNo = payload.MerchantTradeNo || "UNKNOWN";
  const profileId = payload.CustomField2 || "";

  try {
    const config = getEcpayConfig();
    if (payload.MerchantID && payload.MerchantID !== config.merchantId) return textResponse("0|INVALID_MERCHANT", 400);
    if (!payload.CheckMacValue) {
      await recordPaymentEvent({ merchantTradeNo, eventType: "recurring_missing_checkmac", payload });
      return textResponse("0|MISSING_CHECKMAC", 400);
    }
    if (!verifyCheckMacValue(payload, config.hashKey, config.hashIV)) {
      await recordPaymentEvent({ merchantTradeNo, eventType: "recurring_invalid_checkmac", payload });
      return textResponse("0|INVALID_CHECKMAC", 400);
    }

    const profile = profileId
      ? await supabaseAdmin.from("subscription_profiles").select("*").eq("id", profileId).maybeSingle()
      : await supabaseAdmin.from("subscription_profiles").select("*").eq("merchant_trade_no", merchantTradeNo).maybeSingle();
    if (profile.error || !profile.data) {
      await recordPaymentEvent({ merchantTradeNo, eventType: "recurring_profile_not_found", payload });
      return textResponse("0|PROFILE_NOT_FOUND", 404);
    }

    const rtnCode = String(payload.RtnCode || payload.TradeStatus || "");
    const amount = Number(payload.TradeAmt || payload.Amount || profile.data.period_amount || 0);
    const paidAt = parsePaidAt(payload.PaymentDate) || new Date().toISOString();
    const providerTradeNo = payload.TradeNo || null;
    const success = rtnCode === "1" || /paid|success/i.test(String(payload.RtnMsg || ""));
    const orderMerchantTradeNo = providerTradeNo ? `SUB${providerTradeNo}` : merchantTradeNo;

    const existingOrder = await findExistingRecurringOrder({ merchantTradeNo: orderMerchantTradeNo, providerTradeNo });
    let order = existingOrder;

    if (!order) {
      const inserted = await supabaseAdmin.from("payment_orders").insert({
        user_id: profile.data.user_id,
        provider: "ecpay_recurring",
        merchant_trade_no: orderMerchantTradeNo,
        plan_code: profile.data.plan_code,
        amount,
        currency: "TWD",
        status: success ? "paid" : "failed",
        item_name: `安感島訂閱自動扣款｜${profile.data.plan_code}`,
        trade_desc: "ANGANDAO Subscription Recurring Charge",
        vip_days: 30,
        provider_trade_no: providerTradeNo,
        paid_at: success ? paidAt : null,
        provider_payload: { ...payload, original_merchant_trade_no: merchantTradeNo, build_tag: RECURRING_NOTIFY_BUILD_TAG },
        last_error: success ? null : JSON.stringify(payload),
      }).select("*").single();

      if (inserted.error || !inserted.data) throw inserted.error || new Error("recurring_payment_order_insert_failed");
      order = inserted.data;
    }

    const eventExists = await supabaseAdmin
      .from("subscription_events")
      .select("id")
      .eq("subscription_profile_id", profile.data.id)
      .eq("event_type", success ? "recurring_payment_paid" : "recurring_payment_failed")
      .eq("payment_order_id", order.id)
      .limit(1)
      .maybeSingle();
    if (eventExists.error) throw eventExists.error;

    if (!eventExists.data) {
      await supabaseAdmin.from("subscription_events").insert({
        subscription_profile_id: profile.data.id,
        user_id: profile.data.user_id,
        event_type: success ? "recurring_payment_paid" : "recurring_payment_failed",
        merchant_trade_no: merchantTradeNo,
        payment_order_id: order.id,
        provider_payload: { ...payload, build_tag: RECURRING_NOTIFY_BUILD_TAG },
      });
    }

    if (success) {
      const validUntil = addDaysIso(paidAt, 30);
      await supabaseAdmin.from("subscription_profiles").update({
        status: "active",
        current_period_start: paidAt,
        current_period_end: validUntil,
        next_charge_at: validUntil,
        raw_payload: { ...payload, build_tag: RECURRING_NOTIFY_BUILD_TAG },
        last_provider_error: null,
        updated_at: new Date().toISOString(),
      }).eq("id", profile.data.id);

      await upsertVipEntitlement({ userId: profile.data.user_id, validUntil });
      await insertLedgerIfMissing({ userId: profile.data.user_id, paymentOrderId: order.id, amount, paidAt, profileId: profile.data.id, providerTradeNo });
      await insertEntitlementEventIfMissing({ userId: profile.data.user_id, paymentOrderId: order.id, profileId: profile.data.id, planCode: profile.data.plan_code, paidAt, validUntil });
      await insertInvoiceRequestIfMissing({
        userId: profile.data.user_id,
        paymentOrderId: order.id,
        profileId: profile.data.id,
        itemName: order.item_name,
        amount,
      });
    } else {
      await supabaseAdmin.from("subscription_profiles").update({
        status: "past_due",
        raw_payload: { ...payload, build_tag: RECURRING_NOTIFY_BUILD_TAG },
        last_provider_error: payload.RtnMsg || JSON.stringify(payload),
        updated_at: new Date().toISOString(),
      }).eq("id", profile.data.id);
    }

    return textResponse("1|OK");
  } catch (error: any) {
    await recordPaymentEvent({ merchantTradeNo, eventType: "recurring_notify_exception", payload: { payload, message: error?.message || "unknown" } });
    return textResponse("0|SERVER_ERROR", 500);
  }
}
