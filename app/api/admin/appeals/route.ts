import { NextResponse } from "next/server";
import {
  adminErrorResponse,
  getAdminUserFromRequest,
  writeAdminAudit,
} from "@/lib/server/adminAuth";
import { APPEALS_BUILD_TAG, listAdminAppeals } from "@/lib/server/appeals";
import { cleanText } from "@/lib/server/safety";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const admin = await getAdminUserFromRequest(req, { permission: "appeals.manage" });
    const url = new URL(req.url);
    const status = cleanText(url.searchParams.get("status") || "", 40);
    const limit = Number(url.searchParams.get("limit") || 100);
    const appeals = await listAdminAppeals(status, limit);
    await writeAdminAudit(req, {
      adminUserId: admin.userId,
      actionType: "admin_appeals_listed",
      targetType: "appeals",
      metadata: { status, limit },
    });
    return NextResponse.json({ appeals, build_tag: APPEALS_BUILD_TAG });
  } catch (error: any) {
    const result = adminErrorResponse(error);
    return NextResponse.json({ ...result.body, build_tag: APPEALS_BUILD_TAG }, { status: result.status });
  }
}
