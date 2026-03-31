import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  createCheckMacValue,
  formatTradeDate,
  generateMerchantTradeNo,
  getEcpayConfig,
} from "@/lib/ecpay";

export const runtime = "nodejs";

type CheckoutRequestBody = {
  planCode?: string;
};

const VIP_MONTH_PRICE = 199;
const VIP_MONTH_DAYS = 30;
const VIP_MONTH_PLAN_CODE = "vip_month";

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

function getChoosePaymentOverride(): "Credit" | "ATM" | "ALL" | null {
  const raw = String(process.env.ECPAY_FORCE_CHOOSE_PAYMENT || "").trim().toUpperCase();
  if (raw === "CREDIT") return "Credit";
  if (raw === "ATM") return "ATM";
  if (raw === "ALL") return "ALL";
  return null;
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
    const planCode = String(body.planCode || "").trim() || VIP_MONTH_PLAN_CODE;

    if (planCode !== VIP_MONTH_PLAN_CODE) {
      return NextResponse.json({ error: "目前只支援 VIP 月方案付款。" }, { status: 400 });
    }

    const config = getEcpayConfig();
    const dynamicOrigin = getDynamicOrigin(req);
    const fixedOrigin = getFixedOrigin();
    const origin = fixedOrigin || dynamicOrigin;
    const merchantTradeNo = generateMerchantTradeNo("VIP");
    const choosePayment = getChoosePaymentOverride() || "Credit";

    const { error: insertError } = await supabaseAdmin.from("payment_orders").insert({
      user_id: userId,
      provider: "ecpay",
      merchant_trade_no: merchantTradeNo,
      plan_code: VIP_MONTH_PLAN_CODE,
      amount: VIP_MONTH_PRICE,
      currency: "TWD",
      status: "pending",
      item_name: "安感島 VIP 月方案",
      trade_desc: "ANGANDAO VIP Monthly",
      vip_days: VIP_MONTH_DAYS,
      provider_payload: {
        source: "pricing_page",
        choose_payment: choosePayment,
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
      TotalAmount: String(VIP_MONTH_PRICE),
      TradeDesc: choosePayment === "ATM" ? "ANGANDAO ReturnURL Test" : "ANGANDAO VIP Monthly",
      ItemName: choosePayment === "ATM" ? "安感島ReturnURL測試訂單" : "安感島VIP月方案",
      ReturnURL: returnUrl,
      ChoosePayment: choosePayment,
      EncryptType: "1",
      ClientBackURL: clientBackUrl,
      OrderResultURL: orderResultUrl,
      NeedExtraPaidInfo: "Y",
      CustomField1: VIP_MONTH_PLAN_CODE,
      CustomField2: merchantTradeNo,
      ItemURL: itemUrl,
      Remark: choosePayment === "ATM" ? "RETURN_URL_TEST" : "VIP_MONTH",
    };

    ecpayFields.CheckMacValue = createCheckMacValue(ecpayFields, config.hashKey, config.hashIV);

    console.info("[ECPAY_CHECKOUT_FIELDS]", {
      merchantTradeNo,
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
    });

    return NextResponse.json({
      action: config.checkoutUrl,
      method: "POST",
      merchantTradeNo,
      fields: ecpayFields,
      debug: {
        stage: config.stage,
        choosePayment,
        originSource: fixedOrigin ? "SITE_URL" : "REQUEST_ORIGIN",
        dynamicOrigin,
        fixedOrigin,
        returnUrl,
        orderResultUrl,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "建立付款流程時發生未預期錯誤。" },
      { status: 500 },
    );
  }
}
