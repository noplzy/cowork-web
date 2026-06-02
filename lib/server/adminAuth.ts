import { getAuthUserFromRequest, type AuthenticatedRequestUser } from "@/lib/serverRoomUtils";
import { insertAdminAuditLog, getClientIp } from "@/lib/server/safety";

export const ADMIN_OPS_BUILD_TAG = "formal-admin-ops-2026-06-02";

function splitEnvList(value?: string) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export type AdminRequestUser = AuthenticatedRequestUser & {
  adminBy: "user_id" | "email";
};

export async function getAdminUserFromRequest(req: Request): Promise<AdminRequestUser> {
  const user = await getAuthUserFromRequest(req);
  const allowedUserIds = new Set(splitEnvList(process.env.ADMIN_USER_IDS));
  const allowedEmails = new Set(splitEnvList(process.env.ADMIN_EMAILS).map((item) => item.toLowerCase()));

  if (allowedUserIds.has(user.userId)) return { ...user, adminBy: "user_id" };
  if (user.email && allowedEmails.has(user.email.toLowerCase())) return { ...user, adminBy: "email" };

  throw Object.assign(new Error("ADMIN_FORBIDDEN"), { status: 403 });
}

export async function writeAdminAudit(req: Request, input: {
  adminUserId: string;
  actionType: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await insertAdminAuditLog({
    actorAdminUserId: input.adminUserId,
    actionType: input.actionType,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    ipAddress: getClientIp(req),
    userAgent: req.headers.get("user-agent") || null,
    metadata: input.metadata ?? {},
  });
}

export function adminErrorResponse(error: any) {
  if (error?.message === "UNAUTHORIZED") {
    return { body: { error: "請先登入後再進入管理功能。", build_tag: ADMIN_OPS_BUILD_TAG }, status: 401 };
  }
  if (error?.message === "ADMIN_FORBIDDEN" || error?.status === 403) {
    return {
      body: {
        error: "此帳號沒有管理員權限。請在 Vercel 設定 ADMIN_USER_IDS 或 ADMIN_EMAILS。",
        code: "ADMIN_FORBIDDEN",
        build_tag: ADMIN_OPS_BUILD_TAG,
      },
      status: 403,
    };
  }
  return { body: { error: error?.message || "Admin operation failed.", build_tag: ADMIN_OPS_BUILD_TAG }, status: 500 };
}
