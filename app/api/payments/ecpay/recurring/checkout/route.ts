import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createCheckMacValue, formatTradeDate, generateMerchantTradeNo, getEcpayConfig } from "@/lib/ecpay";
import { getProductPlan } from "@/lib/productCatalog";

export const runtime = "nodejs";

type RecurringProductPlan = {
  code: string;
  billingMode: string;
  amountTwd: number | null;
  purchaseStatus?: string;
  title?: string;
  invoiceItemName: string;
  tradeDescription: string;
};

function envFlag(name: string) {
  return ["1", "true", "yes", "enabled"].includes(String(process.env[name] || "").trim().toLowerCase());
}

function extractBearer(req: Request): string | null {
  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header) return null;
  const matched = header.match(/^Bearer\s+(.+)$/i);
  return matched ? matched[1].trim() : null;
}

async function getSupabaseUser(userJwt: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) throw new Error("Missing Supabase auth env");

  const authResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseAnon, Authorization: `Bearer ${userJwt}` },
  });

  if (!authResp.ok) return null;
  return (await authResp.json().catch(() => null)) as any;
}

function getOrigin(req: Request) {
  const configured = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;

  const proto = req.headers.get("x-forwarded-proto");
  const host = req.headers.get("x-forwarded-host");
  if (proto && host) return `${proto}://${host}`;

  return new URL(req.url).origin;
}

function canUseRecurringPlan(plan: RecurringProductPlan) {
  if (plan.purchaseStatus === "active") return true;
  return envFlag("ECPAY_RECURRING_ALLOW_NEXT_SPEC");
}

export async function POST(req: Request) {
  try {
    if (!envFlag("ECPAY_RECURRING_ENABLED")) {
      return NextResponse.json(
        {
          error:
            "自動扣款尚未啟用。請確認綠界商店已開通信用卡定期定額 / 自動扣款服務後，才設定 ECPAY_RECURRING_ENABLED=true。",
          code: "RECURRING_DISABLED",
        },
        { status: 400 },
      );
    }

    const userJwt = extractBearer(req);
    if (!userJwt) return NextResponse.json({ error: "缺少登入憑證。" }, { status: 401 });

    const user = await getSupabaseUser(userJwt);
    const userId = user?.id as string | undefined;
    if (!userId) return NextResponse.json({ error: "登入狀態已過期。" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { planCode?: string };
    const planCode = String(body.planCode || "companion_basic_299").trim();
    const plan = getProductPlan(planCode) as RecurringProductPlan | undefined;

    if (!plan || plan.billingMode !== "subscription" || plan.amountTwd === null) {
      return NextResponse.json({ error: "這不是可建立自動扣款的訂閱方案。" }, { status: 400 });
    }

    if (!canUseRecurringPlan(plan)) {
      return NextResponse.json(
        {
          error: "此訂閱方案目前仍是 next-spec，尚未開放自動扣款。",
          code: "RECURRING_PLAN_NOT_OPEN",
        },
        { status: 400 },
      );
    }

    const config = getEcpayConfig();
    const origin = getOrigin(req);
    const merchantTradeNo = generateMerchantTradeNo("SUB");
    const merchantMemberId = `u${userId.replaceAll("-", "").slice(0, 19)}`;

    const profile = await supabaseAdmin
      .from("subscription_profiles")
      .insert({
        user_id: userId,
        provider: "ecpay",
        plan_code: plan.code,
        status: "pending",
        merchant_member_id: merchantMemberId,
        merchant_trade_no: merchantTradeNo,
        period_amount: plan.amountTwd,
        period_type: "M",
        frequency: 1,
        exec_times: 999,
        auto_renew: true,
        raw_payload: { plan, source: "recurring_checkout_v1081" },
      })
      .select("*")
      .single();

    if (profile.error || !profile.data) {
      return NextResponse.json({ error: profile.error?.message || "建立訂閱 profile 失敗。" }, { status: 400 });
    }

    const returnUrl = `${origin}/api/payments/ecpay/recurring/notify`;
    const clientBackUrl = `${origin}/account/billing`;

    const ecpayFields: Record<string, string> = {
      MerchantID: config.merchantId,
      MerchantTradeNo: merchantTradeNo,
      MerchantTradeDate: formatTradeDate(new Date()),
      PaymentType: "aio",
      TotalAmount: String(plan.amountTwd),
      TradeDesc: plan.tradeDescription,
      ItemName: plan.invoiceItemName,
      ReturnURL: returnUrl,
      PeriodReturnURL: returnUrl,
      ChoosePayment: "Credit",
      EncryptType: "1",
      ClientBackURL: clientBackUrl,
      NeedExtraPaidInfo: "Y",
      CustomField1: plan.code,
      CustomField2: profile.data.id,
      MerchantMemberID: merchantMemberId,
      PeriodAmount: String(plan.amountTwd),
      PeriodType: "M",
      Frequency: "1",
      ExecTimes: "999",
      Remark: "SUBSCRIPTION_PROFILE_V1081",
    };

    ecpayFields.CheckMacValue = createCheckMacValue(ecpayFields, config.hashKey, config.hashIV);

    await supabaseAdmin.from("subscription_events").insert({
      subscription_profile_id: profile.data.id,
      user_id: userId,
      event_type: "recurring_checkout_created",
      merchant_trade_no: merchantTradeNo,
      provider_payload: { fields_without_checkmac: { ...ecpayFields, CheckMacValue: "[redacted]" } },
    });

    return NextResponse.json({ action: config.checkoutUrl, method: "POST", merchantTradeNo, fields: ecpayFields });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "建立自動扣款流程失敗。" }, { status: 500 });
  }
}
