import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  createCheckMacValue,
  formatTradeDate,
  generateMerchantTradeNo,
  getEcpayConfig,
  getOneTimeCheckoutPaymentConfig,
  redactEcpayFields,
} from "@/lib/ecpay";
import { normalizeInvoicePreference } from "@/lib/invoicePreferences";
import { resolvePurchasableBillingPlan } from "@/lib/billingPlans";

export const runtime = "nodejs";

const CHECKOUT_BUILD_TAG = "ecpay-checkout-v119-2026-06-27";

type CheckoutRequestBody = { planCode?: string; invoicePreference?: unknown };

function extractBearer(req: Request): string | null {
  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  const matched = header?.match(/^Bearer\s+(.+)$/i);
  return matched ? matched[1].trim() : null;
}

async function getSupabaseUser(userJwt: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const authResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseAnon, Authorization: `Bearer ${userJwt}` },
  });
  if (!authResp.ok) return null;
  return (await authResp.json().catch(() => null)) as any;
}

function getDynamicOrigin(req: Request): string {
  const proto = req.headers.get("x-forwarded-proto");
  const host = req.headers.get("x-forwarded-host");
  if (proto && host) return `${proto}://${host}`;
  return new URL(req.url).origin;
}

function getFixedOrigin(): string | null {
  const configured = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  return configured.trim().replace(/\/$/, "") || null;
}

async function recordCheckoutEvent(input: {
  merchantTradeNo: string;
  eventType: string;
  rawPayload: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("payment_events").insert({
    merchant_trade_no: input.merchantTradeNo,
    provider: "ecpay",
    event_type: input.eventType,
    raw_payload: input.rawPayload,
  });
  if (error) {
    console.warn("[ECPAY_CHECKOUT_EVENT_INSERT_ERROR]", {
      merchantTradeNo: input.merchantTradeNo,
      eventType: input.eventType,
      message: error.message,
    });
  }
}

export async function POST(req: Request) {
  try {
    const userJwt = extractBearer(req);
    if (!userJwt) return NextResponse.json({ error: "缺少登入憑證，請重新登入後再試。" }, { status: 401 });

    const user = await getSupabaseUser(userJwt);
    const userId = user?.id as string | undefined;
    if (!userId) return NextResponse.json({ error: "登入狀態已過期，請重新登入後再試。" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as CheckoutRequestBody;
    const plan = resolvePurchasableBillingPlan(String(body.planCode || "").trim() || "vip_month");
    if (plan.billingMode !== "one_time") {
      return NextResponse.json({ error: "此方案不是一次性付款方案，請改用訂閱付款流程。" }, { status: 400 });
    }

    const invoicePreference = normalizeInvoicePreference(body.invoicePreference, user.email || "");
    const config = getEcpayConfig();
    const paymentConfig = getOneTimeCheckoutPaymentConfig();
    const origin = getFixedOrigin() || getDynamicOrigin(req);
    const merchantTradeNo = generateMerchantTradeNo("VIP");
    const amount = Math.round(Number(plan.amount || 0));
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "付款金額必須為大於 0 的整數。" }, { status: 400 });
    }

    const tradeDesc = plan.tradeDescription;
    const itemName = plan.invoiceItemName;

    const providerPayload = {
      source: "pricing_page",
      choose_payment: paymentConfig.choosePayment,
      choose_sub_payment: paymentConfig.chooseSubPayment || null,
      ignore_payment: paymentConfig.ignorePayment || null,
      store_id: paymentConfig.storeId || null,
      payment_mode: paymentConfig.paymentMode,
      stage: config.stage,
      billing_mode: plan.billingMode,
      auto_renew: plan.autoRenew,
      support_summary: plan.supportSummary,
      value_metric: plan.valueMetric,
      invoice_preference: invoicePreference,
      invoice_preference_build_tag: CHECKOUT_BUILD_TAG,
      product_catalog_version: "v119",
      checkout_build_tag: CHECKOUT_BUILD_TAG,
    };

    const { error: insertError } = await supabaseAdmin.from("payment_orders").insert({
      user_id: userId,
      provider: "ecpay",
      merchant_trade_no: merchantTradeNo,
      plan_code: plan.code,
      amount,
      currency: "TWD",
      status: "pending",
      item_name: itemName,
      trade_desc: tradeDesc,
      vip_days: Number(plan.entitlementDays || 0),
      provider_payload: providerPayload,
      invoice_preference: invoicePreference,
    });
    if (insertError) return NextResponse.json({ error: `建立付款訂單失敗：${insertError.message}` }, { status: 500 });

    const ecpayFields: Record<string, string> = {
      MerchantID: config.merchantId,
      MerchantTradeNo: merchantTradeNo,
      MerchantTradeDate: formatTradeDate(new Date()),
      PaymentType: "aio",
      TotalAmount: String(amount),
      TradeDesc: tradeDesc,
      ItemName: itemName,
      ReturnURL: `${origin}/api/payments/ecpay/notify`,
      ChoosePayment: paymentConfig.choosePayment,
      EncryptType: "1",
      ClientBackURL: `${origin}/pricing`,
      OrderResultURL: `${origin}/api/payments/ecpay/order-result`,
      NeedExtraPaidInfo: paymentConfig.needExtraPaidInfo,
      CustomField1: plan.code,
      CustomField2: merchantTradeNo,
      CustomField3: invoicePreference.buyerEmail || user.email || "",
      ItemURL: `${origin}/pricing`,
      Remark: "VIP_MONTH_ONE_TIME_V119",
    };

    if (paymentConfig.chooseSubPayment) ecpayFields.ChooseSubPayment = paymentConfig.chooseSubPayment;
    if (paymentConfig.ignorePayment) ecpayFields.IgnorePayment = paymentConfig.ignorePayment;
    if (paymentConfig.storeId) ecpayFields.StoreID = paymentConfig.storeId;

    ecpayFields.CheckMacValue = createCheckMacValue(ecpayFields, config.hashKey, config.hashIV);

    await recordCheckoutEvent({
      merchantTradeNo,
      eventType: "checkout_created",
      rawPayload: {
        action: config.checkoutUrl,
        checkout_build_tag: CHECKOUT_BUILD_TAG,
        fields_without_checkmac: redactEcpayFields(ecpayFields),
        invoice_preference: invoicePreference,
        diagnostic: {
          stage: config.stage,
          choose_payment: paymentConfig.choosePayment,
          payment_mode: paymentConfig.paymentMode,
          has_store_id: Boolean(paymentConfig.storeId),
          using_all_enabled_methods: paymentConfig.choosePayment === "ALL",
        },
      },
    });

    return NextResponse.json({
      action: config.checkoutUrl,
      method: "POST",
      merchantTradeNo,
      fields: ecpayFields,
      diagnostic: {
        build_tag: CHECKOUT_BUILD_TAG,
        choose_payment: paymentConfig.choosePayment,
        payment_mode: paymentConfig.paymentMode,
        invoice_preference_kind: invoicePreference.kind,
        invoice_carrier_kind: invoicePreference.carrierKind,
      },
    });
  } catch (error: any) {
    const message = error?.message || "建立付款流程時發生未預期錯誤。";
    return NextResponse.json({ error: message, build_tag: CHECKOUT_BUILD_TAG }, { status: /尚未開放付款/.test(message) ? 400 : 500 });
  }
}
