import { NextResponse } from "next/server";
import { BILLING_AUTOMATION_BUILD_TAG, processInvoiceTasks, verifyBillingAutomationSecret } from "@/lib/server/billingAutomation";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    verifyBillingAutomationSecret(req);
    const invoices = await processInvoiceTasks(30);
    return NextResponse.json({ ok: true, invoices, build_tag: BILLING_AUTOMATION_BUILD_TAG });
  } catch (error: any) {
    const status = error?.status || (/UNAUTHORIZED/.test(error?.message || "") ? 401 : 500);
    return NextResponse.json({ error: error?.message || "invoice processing failed", build_tag: BILLING_AUTOMATION_BUILD_TAG }, { status });
  }
}
