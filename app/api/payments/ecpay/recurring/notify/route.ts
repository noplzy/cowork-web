import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getEcpayConfig,
  parseFormEncodedPayload,
  verifyCheckMacValue,
} from "@/lib/ecpay";
import { getProductPlan } from "@/lib/productCatalog";
import { P2_BUILD_TAGS } from "@/lib/p2Status";

export const runtime = "nodejs";

const RECURRING_NOTIFY_BUILD_TAG = P2_BUILD_TAGS.recurringNotify;

function textResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function parsePaidAt(value?: string) {
  if (!value) return null;
  const date = new Date(value.replace(/\//g, "-"));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function addDaysIso(baseIso: string, days: number) {
  const base = new Date(baseIso);
  return new Date(base.getTime() + days * 86_400_000).toISOString();
}

async function recordPaymentEvent(input: {
  merchantTradeNo: string;
  eventType: string;
  payload: unknown;
}) {
  await supabaseAdmin.from("payment_events").insert({
    merchant_trade_no: input.merchantTradeNo,
    provider: "ecpay",
    event_type: input.eventType,
    raw_payload: input.payload,
  });
}

async function findExistingRecurringOrder(input: {
  merchantTradeNo: string;
  providerTradeNo: string | null;
}) {
  if (input.providerTradeNo) {
    const byProvider = await supabaseAdmin
      .from("payment_orders")
      .select("*")
      .eq("provider", "ecpay_recurring")
      .eq("provider_trade_no", input.providerTradeNo)
      .limit(1)
      .maybeSingle();
    if (byProvider.error) throw byProvider.error;
    if (byProvider.data) return byProvider.data;
  }

  const byMerchant = await supabaseAdmin
    .from("payment_orders")
    .select("*")
    .eq("provider", "ecpay_recurring")
    .eq("merchant_trade_no", input.merchantTradeNo)
    .limit(1)
    .maybeSingle();
  if (byMerchant.error) throw byMerchant.error;
  return byMerchant.data || null;
}

async function insertLedgerIfMissing(input: {
  userId: string;
  paymentOrderId: string;
  amount: number;
  paidAt: string;
  profileId: string;
  providerTradeNo: string | null;
  invoicePreference: unknown;
  planCode: string;
}) {
  const existing = await supabaseAdmin
    .from("billing_ledger")
    .select("id")
    .eq("payment_order_id", input.paymentOrderId)
    .eq("ledger_type", "payment")
    .limit(1)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return;

  const inserted = await supabaseAdmin.from("billing_ledger").insert({
    user_id: input.userId,
    provider: "ecpay_recurring",
    ledger_type: "payment",
    direction: "credit",
    amount_twd: input.amount,
    currency: "TWD",
    payment_order_id: input.paymentOrderId,
    description: `訂閱自動扣款成功｜${input.planCode}`,
    occurred_at: input.paidAt,
    metadata: {
      subscription_profile_id: input.profileId,
      provider_trade_no: input.providerTradeNo,
      invoice_preference: input.invoicePreference,
      plan_code: input.planCode,
      build_tag: RECURRING_NOTIFY_BUILD_TAG,
    },
  });
  if (inserted.error) throw inserted.error;
}

async function insertInvoiceRequestIfMissing(input: {
  userId: string;
  paymentOrderId: string;
  profileId: string;
  itemName: string;
  amount: number;
  invoicePreference: unknown;
}) {
  const existing = await supabaseAdmin
    .from("invoice_events")
    .select("id")
    .eq("payment_order_id", input.paymentOrderId)
    .eq("event_type", "requested")
    .limit(1)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return;

  const inserted = await supabaseAdmin.from("invoice_events").insert({
    user_id: input.userId,
    payment_order_id: input.paymentOrderId,
    provider: "ecpay_invoice",
    event_type: "requested",
    metadata: {
      source: "recurring_payment_v130",
      subscription_profile_id: input.profileId,
      item_name: input.itemName,
      amount: input.amount,
      invoice_preference: input.invoicePreference,
      build_tag: RECURRING_NOTIFY_BUILD_TAG,
    },
  });
  if (inserted.error) throw inserted.error;
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const payload = parseFormEncodedPayload(rawBody);
  const merchantTradeNo = payload.MerchantTradeNo || "UNKNOWN";
  const profileId = payload.CustomField2 || "";

  try {
    const config = getEcpayConfig();
    if (payload.MerchantID && payload.MerchantID !== config.merchantId) {
      return textResponse("0|INVALID_MERCHANT", 400);
    }
    if (!payload.CheckMacValue) {
      await recordPaymentEvent({
        merchantTradeNo,
        eventType: "recurring_missing_checkmac",
        payload,
      });
      return textResponse("0|MISSING_CHECKMAC", 400);
    }
    if (!verifyCheckMacValue(payload, config.hashKey, config.hashIV)) {
      await recordPaymentEvent({
        merchantTradeNo,
        eventType: "recurring_invalid_checkmac",
        payload,
      });
      return textResponse("0|INVALID_CHECKMAC", 400);
    }

    const profile = profileId
      ? await supabaseAdmin
          .from("subscription_profiles")
          .select("*")
          .eq("id", profileId)
          .maybeSingle()
      : await supabaseAdmin
          .from("subscription_profiles")
          .select("*")
          .eq("merchant_trade_no", merchantTradeNo)
          .maybeSingle();
    if (profile.error || !profile.data) {
      await recordPaymentEvent({
        merchantTradeNo,
        eventType: "recurring_profile_not_found",
        payload,
      });
      return textResponse("0|PROFILE_NOT_FOUND", 404);
    }

    const plan = getProductPlan(String(profile.data.plan_code || ""));
    if (
      !plan ||
      plan.code !== "rooms_unlimited_299" ||
      plan.billingMode !== "subscription" ||
      plan.amountTwd !== 299
    ) {
      await recordPaymentEvent({
        merchantTradeNo,
        eventType: "recurring_plan_blocked_p2",
        payload: {
          profile_id: profile.data.id,
          profile_plan_code: profile.data.plan_code,
          callback: payload,
          build_tag: RECURRING_NOTIFY_BUILD_TAG,
        },
      });
      return textResponse("0|PLAN_BLOCKED_UNTIL_P3", 400);
    }

    const invoicePreference =
      profile.data.invoice_preference ||
      profile.data.raw_payload?.invoice_preference ||
      null;
    const rtnCode = String(payload.RtnCode || payload.TradeStatus || "");
    const amount = Number(
      payload.TradeAmt || payload.Amount || profile.data.period_amount || 0,
    );
    const paidAt = parsePaidAt(payload.PaymentDate) || new Date().toISOString();
    const providerTradeNo = payload.TradeNo || null;
    const success =
      rtnCode === "1" || /paid|success/i.test(String(payload.RtnMsg || ""));

    if (success && amount !== plan.amountTwd) {
      await recordPaymentEvent({
        merchantTradeNo,
        eventType: "recurring_amount_mismatch",
        payload: {
          expected: plan.amountTwd,
          actual: amount,
          callback: payload,
          build_tag: RECURRING_NOTIFY_BUILD_TAG,
        },
      });
      return textResponse("0|AMOUNT_MISMATCH", 400);
    }

    const orderMerchantTradeNo = providerTradeNo
      ? `SUB${providerTradeNo}`.slice(0, 20)
      : merchantTradeNo;
    let order = await findExistingRecurringOrder({
      merchantTradeNo: orderMerchantTradeNo,
      providerTradeNo,
    });

    if (!order) {
      const inserted = await supabaseAdmin
        .from("payment_orders")
        .insert({
          user_id: profile.data.user_id,
          provider: "ecpay_recurring",
          merchant_trade_no: orderMerchantTradeNo,
          plan_code: plan.code,
          amount,
          currency: "TWD",
          status: success ? "paid" : "failed",
          item_name: plan.invoiceItemName,
          trade_desc: plan.tradeDescription,
          vip_days: Number(plan.entitlementDays || 30),
          provider_trade_no: providerTradeNo,
          paid_at: success ? paidAt : null,
          provider_payload: {
            ...payload,
            original_merchant_trade_no: merchantTradeNo,
            invoice_preference: invoicePreference,
            build_tag: RECURRING_NOTIFY_BUILD_TAG,
          },
          invoice_preference: invoicePreference,
          last_error: success ? null : JSON.stringify(payload),
        })
        .select("*")
        .single();
      if (inserted.error || !inserted.data) {
        throw inserted.error || new Error("recurring_payment_order_insert_failed");
      }
      order = inserted.data;
    } else {
      const updated = await supabaseAdmin
        .from("payment_orders")
        .update({
          status: success ? "paid" : "failed",
          amount,
          paid_at: success ? paidAt : order.paid_at,
          provider_trade_no: providerTradeNo || order.provider_trade_no,
          provider_payload: {
            ...order.provider_payload,
            ...payload,
            original_merchant_trade_no: merchantTradeNo,
            invoice_preference: invoicePreference,
            build_tag: RECURRING_NOTIFY_BUILD_TAG,
          },
          last_error: success ? null : JSON.stringify(payload),
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .select("*")
        .single();
      if (updated.error || !updated.data) throw updated.error;
      order = updated.data;
    }

    const eventType = success
      ? "recurring_payment_paid"
      : "recurring_payment_failed";
    const eventExists = await supabaseAdmin
      .from("subscription_events")
      .select("id")
      .eq("subscription_profile_id", profile.data.id)
      .eq("event_type", eventType)
      .eq("payment_order_id", order.id)
      .limit(1)
      .maybeSingle();
    if (eventExists.error) throw eventExists.error;
    if (!eventExists.data) {
      const eventInsert = await supabaseAdmin.from("subscription_events").insert({
        subscription_profile_id: profile.data.id,
        user_id: profile.data.user_id,
        event_type: eventType,
        merchant_trade_no: merchantTradeNo,
        payment_order_id: order.id,
        provider_payload: {
          ...payload,
          invoice_preference: invoicePreference,
          build_tag: RECURRING_NOTIFY_BUILD_TAG,
        },
      });
      if (eventInsert.error) throw eventInsert.error;
    }

    if (success) {
      const validUntil = addDaysIso(
        paidAt,
        Number(plan.entitlementDays || 30),
      );
      const application = await supabaseAdmin.rpc(
        "cowork_apply_subscription_payment_v2",
        {
          p_payment_order_id: order.id,
          p_user_id: profile.data.user_id,
          p_subscription_profile_id: profile.data.id,
          p_plan_code: plan.code,
          p_period_start: paidAt,
          p_period_end: validUntil,
          p_source: "ecpay_recurring_notify_v130",
          p_metadata: {
            merchant_trade_no: merchantTradeNo,
            provider_trade_no: providerTradeNo,
            build_tag: RECURRING_NOTIFY_BUILD_TAG,
          },
        },
      );
      if (application.error) throw application.error;

      await insertLedgerIfMissing({
        userId: profile.data.user_id,
        paymentOrderId: order.id,
        amount,
        paidAt,
        profileId: profile.data.id,
        providerTradeNo,
        invoicePreference,
        planCode: plan.code,
      });
      await insertInvoiceRequestIfMissing({
        userId: profile.data.user_id,
        paymentOrderId: order.id,
        profileId: profile.data.id,
        itemName: plan.invoiceItemName,
        amount,
        invoicePreference,
      });

      await supabaseAdmin
        .from("subscription_events")
        .insert({
          subscription_profile_id: profile.data.id,
          user_id: profile.data.user_id,
          event_type: "commercial_entitlement_applied",
          merchant_trade_no: merchantTradeNo,
          payment_order_id: order.id,
          provider_payload: {
            application: application.data,
            build_tag: RECURRING_NOTIFY_BUILD_TAG,
          },
        })
        .then(() => undefined);
    } else {
      const update = await supabaseAdmin
        .from("subscription_profiles")
        .update({
          status: "past_due",
          commercial_entitlement_status: "payment_failed",
          raw_payload: {
            ...profile.data.raw_payload,
            last_notify_payload: payload,
            build_tag: RECURRING_NOTIFY_BUILD_TAG,
          },
          last_provider_error: payload.RtnMsg || JSON.stringify(payload),
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.data.id);
      if (update.error) throw update.error;
    }

    return textResponse("1|OK");
  } catch (error) {
    await recordPaymentEvent({
      merchantTradeNo,
      eventType: "recurring_notify_exception",
      payload: {
        payload,
        message: error instanceof Error ? error.message : "unknown",
        build_tag: RECURRING_NOTIFY_BUILD_TAG,
      },
    });
    return textResponse("0|SERVER_ERROR", 500);
  }
}
