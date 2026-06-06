import { NextResponse } from "next/server";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit } from "@/lib/server/adminAuth";
import { listAuthUsers } from "@/lib/server/admin360";

export const runtime = "nodejs";
export async function GET(req: Request) {
  try {
    const admin = await getAdminUserFromRequest(req);
    const url = new URL(req.url);
    const q = String(url.searchParams.get("q") || "").trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 100);
    const users = await listAuthUsers(q, limit);
    await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "admin_users_searched", targetType: "auth_users", metadata: { q: q ? "[provided]" : "", limit } });
    return NextResponse.json({ users, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) { const res = adminErrorResponse(error); return NextResponse.json(res.body, { status: res.status }); }
}
