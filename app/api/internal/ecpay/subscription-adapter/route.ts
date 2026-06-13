import { NextResponse } from "next/server";
import { runSubscriptionAction, verifyAdapterRequest } from "@/lib/server/ecpayOfficialClient";

export const runtime = "nodejs";

const BUILD_TAG = "ecpay-subscription-adapter-v116-2026-06-13";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function firstString(...values: any[]) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function resolveAction(task: any): "Cancel" | "ReAuth" {
  const raw = String(task?.action_type || task?.action || "").toLowerCase();
  if (raw.includes("reauth")) return "ReAuth";
  return "Cancel";
}

export async function GET(req: Request) {
  try {
    verifyAdapterRequest(req);
    return json({ ok: true, adapter: "subscription", build_tag: BUILD_TAG });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || "unauthorized" }, error?.status || 401);
  }
}

export async function POST(req: Request) {
  try {
    verifyAdapterRequest(req);
    const payload = await req.json().catch(() => ({}));
    const task = payload.task || {};
    const profile = payload.subscription_profile || task.subscription_profiles || {};
    const merchantTradeNo = firstString(profile.merchant_trade_no, profile.raw_payload?.MerchantTradeNo, task.merchant_trade_no);
    if (!merchantTradeNo) throw new Error("missing_subscription_merchant_trade_no");

    const result = await runSubscriptionAction({ merchantTradeNo, action: resolveAction(task) });
    return json({ ...result, task_id: task.id || null, build_tag: BUILD_TAG });
  } catch (error: any) {
    const message = error?.message || "subscription_adapter_error";
    const status = error?.status || (/UNAUTHORIZED/.test(message) ? 401 : 500);
    return json({ status: "failed", error: message, build_tag: BUILD_TAG }, status);
  }
}
