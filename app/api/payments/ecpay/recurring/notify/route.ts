import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getEcpayConfig, parseFormEncodedPayload, verifyCheckMacValue } from "@/lib/ecpay";

export const runtime = "nodejs";

function textResponse(body: string, status = 200) { return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } }); }
function parsePaidAt(value?: string) { if (!value) return null; const date = new Date(value.replace(/\//g, "-")); return Number.isNaN(date.getTime()) ? null : date.toISOString(); }

export async function POST(req: Request) {
  const rawBody = await req.text();
  const payload = parseFormEncodedPayload(rawBody);
  const merchantTradeNo = payload.MerchantTradeNo || "UNKNOWN";
  const profileId = payload.CustomField2 || "";

  try {
    const config = getEcpayConfig();
    if (payload.MerchantID && payload.MerchantID !== config.merchantId) return textResponse("0|INVALID_MERCHANT", 400);
    if (payload.CheckMacValue && !verifyCheckMacValue(payload, config.hashKey, config.hashIV)) {
      await supabaseAdmin.from("payment_events").insert({ merchant_trade_no: merchantTradeNo, provider: "ecpay", event_type: "recurring_invalid_checkmac", raw_payload: payload });
      return textResponse("0|INVALID_CHECKMAC", 400);
    }

    const profile = profileId
      ? await supabaseAdmin.from("subscription_profiles").select("*").eq("id", profileId).maybeSingle()
      : await supabaseAdmin.from("subscription_profiles").select("*").eq("merchant_trade_no", merchantTradeNo).maybeSingle();
    if (profile.error || !profile.data) {
      await supabaseAdmin.from("payment_events").insert({ merchant_trade_no: merchantTradeNo, provider: "ecpay", event_type: "recurring_profile_not_found", raw_payload: payload });
      return textResponse("0|PROFILE_NOT_FOUND", 404);
    }

    const rtnCode = String(payload.RtnCode || payload.TradeStatus || "");
    const amount = Number(payload.TradeAmt || payload.Amount || profile.data.period_amount || 0);
    const paidAt = parsePaidAt(payload.PaymentDate) || new Date().toISOString();
    const providerTradeNo = payload.TradeNo || null;
    const success = rtnCode === "1" || /paid|success/i.test(String(payload.RtnMsg || ""));

    const order = await supabaseAdmin.from("payment_orders").insert({ user_id: profile.data.user_id, provider: "ecpay_recurring", merchant_trade_no: merchantTradeNo, plan_code: profile.data.plan_code, amount, currency: "TWD", status: success ? "paid" : "failed", item_name: `安感島訂閱自動扣款｜${profile.data.plan_code}`, trade_desc: "ANGANDAO Subscription Recurring Charge", vip_days: 30, provider_trade_no: providerTradeNo, paid_at: success ? paidAt : null, provider_payload: payload, last_error: success ? null : JSON.stringify(payload) }).select("*").single();

    await supabaseAdmin.from("subscription_events").insert({ subscription_profile_id: profile.data.id, user_id: profile.data.user_id, event_type: success ? "recurring_payment_paid" : "recurring_payment_failed", merchant_trade_no: merchantTradeNo, payment_order_id: order.data?.id ?? null, provider_payload: payload });

    if (success) {
      const validUntil = new Date(new Date(paidAt).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabaseAdmin.from("subscription_profiles").update({ status: "active", current_period_start: paidAt, current_period_end: validUntil, next_charge_at: validUntil, raw_payload: payload, updated_at: new Date().toISOString() }).eq("id", profile.data.id);
      await supabaseAdmin.from("billing_ledger").insert({ user_id: profile.data.user_id, provider: "ecpay_recurring", ledger_type: "payment", direction: "credit", amount_twd: amount, currency: "TWD", payment_order_id: order.data?.id ?? null, description: "訂閱自動扣款成功", occurred_at: paidAt, metadata: { subscription_profile_id: profile.data.id, provider_trade_no: providerTradeNo } });
      await supabaseAdmin.from("entitlement_events").insert({ user_id: profile.data.user_id, event_type: "extend", plan_code: profile.data.plan_code, entitlement_key: "vip", quantity: 1, valid_from: paidAt, valid_until: validUntil, payment_order_id: order.data?.id ?? null, metadata: { subscription_profile_id: profile.data.id } });
      await supabaseAdmin.from("invoice_events").insert({ user_id: profile.data.user_id, payment_order_id: order.data?.id ?? null, provider: "ecpay_invoice", event_type: "requested", metadata: { source: "recurring_payment", subscription_profile_id: profile.data.id } });
    } else {
      await supabaseAdmin.from("subscription_profiles").update({ status: "past_due", raw_payload: payload, updated_at: new Date().toISOString() }).eq("id", profile.data.id);
    }

    return textResponse("1|OK");
  } catch (error: any) {
    await supabaseAdmin.from("payment_events").insert({ merchant_trade_no: merchantTradeNo, provider: "ecpay", event_type: "recurring_notify_exception", raw_payload: { payload, message: error?.message || "unknown" } });
    return textResponse("0|SERVER_ERROR", 500);
  }
}
