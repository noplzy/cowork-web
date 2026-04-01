import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  createCheckMacValue,
  formatTradeDate,
  generateMerchantTradeNo,
  getEcpayConfig,
} from "@/lib/ecpay";
import { resolvePurchasableBillingPlan } from "@/lib/billingPlans";

export const runtime = "nodejs";

type CheckoutRequestBody = {
  planCode?: string;
};

function extractBearer(req: Request): string | null {
  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header) return null;
  const matched = header.match(/^Bearer\s+(.+)$/i);
  return matched ? matched[1].trim() : null;
}

async function getSupabaseUser(userJwt: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const authResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnon,
      Authorization: `Bearer ${userJwt}`,
    },
  });

  if (!authResp.ok) return null;
  return (await authResp.json().catch(() => null)) as any;
}

function getDynamicOrigin(req: Request): string {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return new URL(req.url).origin;
}

function getFixedOrigin(): string | null {
  const configured = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  const normalized = configured.trim().replace(/\/$/, "");
  return normalized || null;
}

/**
 * Production rule:
 * - In production, always use Credit.
 * - In stage only, you may override payment method with ECPAY_FORCE_CHOOSE_PAYMENT=ATM / ALL / CREDIT.
 */
function resolveChoosePayment(isStage: boolean): "Credit" | "ATM" | "ALL" {
  if (!isStage) return "Credit";

  const raw = String(process.env.ECPAY_FORCE_CHOOSE_PAYMENT || "").trim().toUpperCase();
  if (raw === "ATM") return "ATM";
  if (raw === "ALL") return "ALL";
  if (raw === "CREDIT") return "Credit";
  return "Credit";
}

export async function POST(req: Request) {
  try {
    const userJwt = extractBearer(req);
    if (!userJwt) {
      return NextResponse.json({ error: "缺少登入憑證，請重新登入後再試。" }, { status: 401 });
    }

    const user = await getSupabaseUser(userJwt);
    const userId = user?.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "登入狀態已過期，請重新登入後再試。" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as CheckoutRequestBody;
    const requestedPlanCode = String(body.planCode || "").trim() || "vip_month";
    const plan = resolvePurchasableBillingPlan(requestedPlanCode);

    const config = getEcpayConfig();
    const dynamicOrigin = getDynamicOrigin(req);
    const fixedOrigin = getFixedOrigin();
    const origin = fixedOrigin || dynamicOrigin;
    const merchantTradeNo = generateMerchantTradeNo("VIP");
    const choosePayment = resolveChoosePayment(config.stage);

    const isReturnUrlConnectivityTest = config.stage && choosePayment === "ATM";
    const tradeDesc = isReturnUrlConnectivityTest
      ? "ANGANDAO ReturnURL Test"
      : "ANGANDAO VIP Pilot Monthly";
    const itemName = isReturnUrlConnectivityTest
      ? "安感島ReturnURL測試訂單"
      : "安感島 VIP 月方案（試營運）";

    const { error: insertError } = await supabaseAdmin.from("payment_orders").insert({
      user_id: userId,
      provider: "ecpay",
      merchant_trade_no: merchantTradeNo,
      plan_code: plan.code,
      amount: Number(plan.amount || 0),
      currency: "TWD",
      status: "pending",
      item_name: itemName,
      trade_desc: tradeDesc,
      vip_days: Number(plan.entitlementDays || 0),
      provider_payload: {
        source: "pricing_page",
        choose_payment: choosePayment,
        stage: config.stage,
        return_url_connectivity_test: isReturnUrlConnectivityTest,
        billing_mode: plan.billingMode,
        auto_renew: plan.autoRenew,
        support_summary: plan.supportSummary,
        future_launch_reserved: true,
      },
    });

    if (insertError) {
      return NextResponse.json({ error: `建立付款訂單失敗：${insertError.message}` }, { status: 500 });
    }

    const returnUrl = `${origin}/api/payments/ecpay/notify`;
    const orderResultUrl = `${origin}/api/payments/ecpay/order-result`;
    const clientBackUrl = `${origin}/pricing`;
    const itemUrl = `${origin}/pricing`;

    const ecpayFields: Record<string, string> = {
      MerchantID: config.merchantId,
      MerchantTradeNo: merchantTradeNo,
      MerchantTradeDate: formatTradeDate(new Date()),
      PaymentType: "aio",
      TotalAmount: String(Number(plan.amount || 0)),
      TradeDesc: tradeDesc,
      ItemName: itemName,
      ReturnURL: returnUrl,
      ChoosePayment: choosePayment,
      EncryptType: "1",
      ClientBackURL: clientBackUrl,
      OrderResultURL: orderResultUrl,
      NeedExtraPaidInfo: "Y",
      CustomField1: plan.code,
      CustomField2: merchantTradeNo,
      ItemURL: itemUrl,
      Remark: isReturnUrlConnectivityTest ? "RETURN_URL_TEST" : "VIP_MONTH_PILOT",
    };

    ecpayFields.CheckMacValue = createCheckMacValue(ecpayFields, config.hashKey, config.hashIV);

    console.info("[ECPAY_CHECKOUT_FIELDS]", {
      merchantTradeNo,
      planCode: plan.code,
      stage: config.stage,
      merchantId: config.merchantId,
      action: config.checkoutUrl,
      choosePayment,
      originSource: fixedOrigin ? "SITE_URL" : "REQUEST_ORIGIN",
      dynamicOrigin,
      fixedOrigin,
      returnUrl,
      orderResultUrl,
      clientBackUrl,
      itemUrl,
      isReturnUrlConnectivityTest,
    });

    return NextResponse.json({
      action: config.checkoutUrl,
      method: "POST",
      merchantTradeNo,
      fields: ecpayFields,
    });
  } catch (error: any) {
    const message = error?.message || "建立付款流程時發生未預期錯誤。";
    const status = /尚未開放付款/.test(message) ? 400 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
