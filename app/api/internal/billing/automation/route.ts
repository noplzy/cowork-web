import { NextResponse } from "next/server";
import { BILLING_AUTOMATION_BUILD_TAG, processInvoiceTasks, processRefundTasks, processSubscriptionTasks, verifyBillingAutomationSecret } from "@/lib/server/billingAutomation";
export const runtime = "nodejs";
export async function POST(req: Request) { try { verifyBillingAutomationSecret(req); const [invoices, refunds, subscriptions] = await Promise.all([processInvoiceTasks(20), processRefundTasks(20), processSubscriptionTasks(20)]); return NextResponse.json({ ok: true, invoices, refunds, subscriptions, build_tag: BILLING_AUTOMATION_BUILD_TAG }); } catch (error: any) { const status = error?.status || (/UNAUTHORIZED/.test(error?.message || "") ? 401 : 500); return NextResponse.json({ error: error?.message || "billing automation failed", build_tag: BILLING_AUTOMATION_BUILD_TAG }, { status }); } }
export async function GET(req: Request) { return POST(req); }
