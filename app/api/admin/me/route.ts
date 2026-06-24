import { NextResponse } from "next/server";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest } from "@/lib/server/adminAuth";
export const runtime = "nodejs";
export async function GET(req: Request) {
  try {
    const admin = await getAdminUserFromRequest(req);
    return NextResponse.json({ is_admin: true, admin_by: admin.adminBy, admin_source: admin.adminSource, role_key: admin.roleKey, role_assignment_id: admin.roleAssignmentId ?? null, permissions: admin.permissions, user_id: admin.userId, email: admin.email, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}
