import { NextResponse } from "next/server";
import { verifyAdapterRequest } from "@/lib/server/ecpayOfficialClient";

export const runtime = "nodejs";

const BUILD_TAG = "ecpay-health-v116-2026-06-13";

function has(name: string) {
  return Boolean(process.env[name] && String(process.env[name]).trim());
}

export async function GET(req: Request) {
  try {
    verifyAdapterRequest(req);
    return NextResponse.json({
      ok: true,
      build_tag: BUILD_TAG,
      env: {
        ECPAY_STAGE: process.env.ECPAY_STAGE || "",
        SITE_URL: process.env.SITE_URL || "",
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "",
        ECPAY_MERCHANT_ID: has("ECPAY_MERCHANT_ID"),
        ECPAY_HASH_KEY: has("ECPAY_HASH_KEY"),
        ECPAY_HASH_IV: has("ECPAY_HASH_IV"),
        ECPAY_ADAPTER_SECRET: has("ECPAY_ADAPTER_SECRET"),
        ECPAY_INVOICE_API_ENABLED: process.env.ECPAY_INVOICE_API_ENABLED || "",
        ECPAY_INVOICE_ENDPOINT: process.env.ECPAY_INVOICE_ENDPOINT || "",
        ECPAY_REFUND_API_ENABLED: process.env.ECPAY_REFUND_API_ENABLED || "",
        ECPAY_REFUND_ENDPOINT: process.env.ECPAY_REFUND_ENDPOINT || "",
        ECPAY_RECURRING_ENABLED: process.env.ECPAY_RECURRING_ENABLED || "",
        ECPAY_RECURRING_ALLOW_NEXT_SPEC: process.env.ECPAY_RECURRING_ALLOW_NEXT_SPEC || "",
        ECPAY_SUBSCRIPTION_API_ENABLED: process.env.ECPAY_SUBSCRIPTION_API_ENABLED || "",
        ECPAY_SUBSCRIPTION_ENDPOINT: process.env.ECPAY_SUBSCRIPTION_ENDPOINT || "",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "unauthorized" }, { status: error?.status || 401 });
  }
}
