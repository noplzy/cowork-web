import { NextResponse } from "next/server";
import { getBillingReconciliationReport } from "@/lib/server/billingAutomation";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit } from "@/lib/server/adminAuth";
import { cleanText } from "@/lib/server/safety";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const admin = await getAdminUserFromRequest(req);
    const url = new URL(req.url);
    const limit = Math.min(Math.max(Number(cleanText(url.searchParams.get("limit") || "100", 6) || 100), 1), 300);
    const report = await getBillingReconciliationReport(limit);

    await writeAdminAudit(req, {
      adminUserId: admin.userId,
      actionType: "admin_billing_reconciliation_viewed",
      targetType: "billing_reconciliation",
      metadata: { limit },
    });

    return NextResponse.json({ ...report, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}
