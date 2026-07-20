import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  createCheckMacValue,
  formatTradeDate,
  generateMerchantTradeNo,
  getEcpayConfig,
  getRecurringCheckoutPaymentConfig,
} from "@/lib/ecpay";
import {
  buildDefaultInvoicePreference,
  normalizeInvoicePreference,
} from "@/lib/invoicePreferences";
import { getProductPlan } from "@/lib/productCatalog";
import { isRooms299ServerPilotEnabled, P2_BUILD_TAGS } from "@/lib/p2Status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECURRING_CHECKOUT_BUILD_TAG = P2_BUILD_TAGS.recurringCheckout;

type RecurringProductPlan = {
  code: string;
  billingMode: string;
  amountTwd: number | null;
  purchaseStatus?: string;
  purchaseEnabled?: boolean;
  checkoutPlanCode?: string | null;
  title?: string;
  invoiceItemName: string;
  tradeDescription: string;
};

function envFlag(name: string) {
  return ["1", "true", "yes", "enabled"].includes(
    String(process.env[name] || "").trim().toLowerCase(),
  );
}

function extractBearer(req: Request): string | null {
  const header =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header) return null;
  const matched = header.match(/^Bearer\s+(.+)$/i);
  return matched ? matched[1].trim() : null;
}

async function getSupabaseUser(userJwt: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) throw new Error("Missing Supabase auth env");

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseAnon, Authorization: `Bearer ${userJwt}` },
  });
  if (!authResponse.ok) return null;
  return (await authResponse.json().catch(() => null)) as any;
}

function getOrigin(req: Request) {
  const configured = String(
    process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "",
  )
    .trim()
    .replace(/\/$/, "");
  if (configured) return configured;
  const protocol = req.headers.get("x-forwarded-proto");
  const host = req.headers.get("x-forwarded-host");
  if (protocol && host) return `${protocol}://${host}`;
  return new URL(req.url).origin;
}

function recurringAllowlist() {
  return String(process.env.ECPAY_RECURRING_PLAN_ALLOWLIST || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function canUseRecurringPlan(plan: RecurringProductPlan) {
  return (
    envFlag("ECPAY_RECURRING_ENABLED") &&
    isRooms299ServerPilotEnabled() &&
    plan.code === "rooms_unlimited_299" &&
    plan.purchaseStatus === "active" &&
    plan.purchaseEnabled === true &&
    plan.checkoutPlanCode === "rooms_unlimited_299" &&
    recurringAllowlist().includes(plan.code)
  );
}

async function resolveInvoicePreference(
  input: unknown,
  userId: string,
  email: string,
) {
  if (input !== undefined && input !== null) {
    return normalizeInvoicePreference(input, email);
  }

  const saved = await supabaseAdmin
    .from("user_invoice_preferences")
    .select("preference")
    .eq("user_id", userId)
    .maybeSingle();
  if (saved.error) throw saved.error;
  if (saved.data?.preference) {
    return normalizeInvoicePreference(saved.data.preference, email);
  }
  return buildDefaultInvoicePreference(email);
}

export async function POST(req: Request) {
  try {
    if (!envFlag("ECPAY_RECURRING_ENABLED")) {
      return NextResponse.json(
        {
          error:
            "自動扣款尚未啟用。請先確認綠界定期定額服務、訂閱取消、退款、發票與 entitlement E2E。",
          code: "RECURRING_DISABLED",
          build_tag: RECURRING_CHECKOUT_BUILD_TAG,
        },
        { status: 400 },
      );
    }

    const userJwt = extractBearer(req);
    if (!userJwt) {
      return NextResponse.json({ error: "缺少登入憑證。" }, { status: 401 });
    }

    const user = await getSupabaseUser(userJwt);
    const userId = user?.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "登入狀態已過期。" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      planCode?: string;
      invoicePreference?: unknown;
    };
    const planCode = String(body.planCode || "").trim();
    const plan = getProductPlan(planCode) as RecurringProductPlan | undefined;

    if (!plan || plan.billingMode !== "subscription" || plan.amountTwd === null) {
      return NextResponse.json(
        {
          error: "這不是可建立自動扣款的訂閱方案。",
          code: "INVALID_RECURRING_PLAN",
          build_tag: RECURRING_CHECKOUT_BUILD_TAG,
        },
        { status: 400 },
      );
    }

    if (!canUseRecurringPlan(plan)) {
      return NextResponse.json(
        {
          error:
            "此方案仍是 Pricing v2 最終規格，尚未開放自動扣款。不能只靠舊的 ALLOW_NEXT_SPEC 開關繞過商業 gate。",
          code: "RECURRING_PLAN_NOT_OPEN",
          diagnostic: {
            pricing_v2_commercial_enabled: envFlag(
              "PRICING_V2_COMMERCIAL_ENABLED",
            ),
            rooms_299_server_enabled: isRooms299ServerPilotEnabled(),
            plan_purchase_status: plan.purchaseStatus || null,
            plan_purchase_enabled: plan.purchaseEnabled === true,
            plan_in_allowlist: recurringAllowlist().includes(plan.code),
          },
          build_tag: RECURRING_CHECKOUT_BUILD_TAG,
        },
        { status: 400 },
      );
    }

    const existingProfile = await supabaseAdmin
      .from("subscription_profiles")
      .select("id,status,current_period_end,cancel_requested_at,created_at")
      .eq("user_id", userId)
      .eq("plan_code", plan.code)
      .in("status", ["pending", "active", "past_due", "cancel_pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingProfile.error) throw existingProfile.error;
    if (existingProfile.data) {
      const pendingExpired =
        existingProfile.data.status === "pending" &&
        new Date(existingProfile.data.created_at).getTime() <
          Date.now() - 30 * 60 * 1000;
      if (pendingExpired) {
        await supabaseAdmin
          .from("subscription_profiles")
          .update({
            status: "failed",
            last_provider_error: "checkout_abandoned_after_30_minutes",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingProfile.data.id)
          .eq("user_id", userId);
      } else {
        return NextResponse.json(
          {
            error: "你已經有這個方案的有效或處理中訂閱，請先到訂閱管理查看。",
            code: "SUBSCRIPTION_ALREADY_EXISTS",
            subscription: existingProfile.data,
            build_tag: RECURRING_CHECKOUT_BUILD_TAG,
          },
          { status: 409 },
        );
      }
    }

    const invoicePreference = await resolveInvoicePreference(
      body.invoicePreference,
      userId,
      user.email || "",
    );
    const config = getEcpayConfig();
    const paymentConfig = getRecurringCheckoutPaymentConfig();
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
        commercial_entitlement_status: "pending",
        raw_payload: {
          plan,
          source: "recurring_checkout_v130",
          invoice_preference: invoicePreference,
          build_tag: RECURRING_CHECKOUT_BUILD_TAG,
        },
        invoice_preference: invoicePreference,
      })
      .select("*")
      .single();

    if (profile.error || !profile.data) {
      return NextResponse.json(
        { error: profile.error?.message || "建立訂閱 profile 失敗。" },
        { status: 400 },
      );
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
      ChoosePayment: paymentConfig.choosePayment,
      EncryptType: "1",
      ClientBackURL: clientBackUrl,
      NeedExtraPaidInfo: paymentConfig.needExtraPaidInfo,
      CustomField1: plan.code,
      CustomField2: profile.data.id,
      CustomField3: invoicePreference.buyerEmail || user.email || "",
      MerchantMemberID: merchantMemberId,
      PeriodAmount: String(plan.amountTwd),
      PeriodType: "M",
      Frequency: "1",
      ExecTimes: "999",
      Remark: "ROOMS_299_SUBSCRIPTION_V130",
    };
    if (paymentConfig.storeId) ecpayFields.StoreID = paymentConfig.storeId;
    ecpayFields.CheckMacValue = createCheckMacValue(
      ecpayFields,
      config.hashKey,
      config.hashIV,
    );

    await supabaseAdmin.from("subscription_events").insert({
      subscription_profile_id: profile.data.id,
      user_id: userId,
      event_type: "recurring_checkout_created",
      merchant_trade_no: merchantTradeNo,
      provider_payload: {
        fields_without_checkmac: {
          ...ecpayFields,
          CheckMacValue: "[redacted]",
        },
        invoice_preference: invoicePreference,
        build_tag: RECURRING_CHECKOUT_BUILD_TAG,
      },
    });

    return NextResponse.json({
      action: config.checkoutUrl,
      method: "POST",
      merchantTradeNo,
      fields: ecpayFields,
      diagnostic: {
        build_tag: RECURRING_CHECKOUT_BUILD_TAG,
        choose_payment: paymentConfig.choosePayment,
        invoice_preference_kind: invoicePreference.kind,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "建立自動扣款流程失敗。",
        build_tag: RECURRING_CHECKOUT_BUILD_TAG,
      },
      { status: 500 },
    );
  }
}
