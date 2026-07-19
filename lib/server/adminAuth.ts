import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getAuthUserFromRequest,
  type AuthenticatedRequestUser,
} from "@/lib/serverRoomUtils";
import { getClientIp, insertAdminAuditLog } from "@/lib/server/safety";

export const ADMIN_OPS_BUILD_TAG = "admin-rbac-permission-closure-v129-2026-07-18";

export type AdminPermission =
  | "admin.read"
  | "admin.manage_roles"
  | "users.read"
  | "identity.review"
  | "buddies.review"
  | "buddies.disputes"
  | "support.manage"
  | "safety.manage"
  | "appeals.manage"
  | "refunds.manage"
  | "billing.manage"
  | "rooms.manage"
  | "notifications.manage"
  | "ai.manage";

export type AdminRoleKey =
  | "owner"
  | "ops"
  | "support"
  | "safety"
  | "finance"
  | "viewer"
  | "custom";

export const ALL_ADMIN_PERMISSIONS: readonly AdminPermission[] = [
  "admin.read",
  "admin.manage_roles",
  "users.read",
  "identity.review",
  "buddies.review",
  "buddies.disputes",
  "support.manage",
  "safety.manage",
  "appeals.manage",
  "refunds.manage",
  "billing.manage",
  "rooms.manage",
  "notifications.manage",
  "ai.manage",
] as const;

export const ADMIN_ROLE_PRESET_PERMISSIONS: Record<AdminRoleKey, AdminPermission[]> = {
  owner: [...ALL_ADMIN_PERMISSIONS],
  ops: [
    "admin.read",
    "users.read",
    "identity.review",
    "buddies.review",
    "buddies.disputes",
    "support.manage",
    "safety.manage",
    "appeals.manage",
    "rooms.manage",
    "notifications.manage",
  ],
  support: [
    "admin.read",
    "users.read",
    "support.manage",
    "identity.review",
    "notifications.manage",
  ],
  safety: [
    "admin.read",
    "users.read",
    "safety.manage",
    "appeals.manage",
    "rooms.manage",
    "buddies.disputes",
    "notifications.manage",
  ],
  finance: [
    "admin.read",
    "users.read",
    "billing.manage",
    "refunds.manage",
    "notifications.manage",
  ],
  viewer: ["admin.read", "users.read"],
  custom: ["admin.read"],
};

function splitEnvList(value?: string) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePermissions(value: unknown): AdminPermission[] {
  if (!Array.isArray(value)) return [];
  const valid = new Set<string>(ALL_ADMIN_PERMISSIONS);
  return Array.from(
    new Set(value.map((item) => String(item)).filter((item) => valid.has(item))),
  ) as AdminPermission[];
}

function unionPermissions(...groups: AdminPermission[][]) {
  return Array.from(new Set(groups.flat())) as AdminPermission[];
}

function isMissingRbacTable(message?: string | null) {
  return /relation .*admin_role_assignments.* does not exist/i.test(
    String(message || ""),
  );
}

export type AdminAuthSource = "db_role" | "env_user_id" | "env_email";

export type AdminRequestUser = AuthenticatedRequestUser & {
  adminBy: "db_role" | "user_id" | "email";
  adminSource: AdminAuthSource;
  roleKey: AdminRoleKey;
  permissions: AdminPermission[];
  roleAssignmentId?: string | null;
};

export function hasAdminPermission(
  admin: Pick<AdminRequestUser, "permissions">,
  permission: AdminPermission,
) {
  return admin.permissions.includes(permission);
}

export function requireAdminPermission(
  admin: Pick<AdminRequestUser, "permissions">,
  permission: AdminPermission,
) {
  if (!hasAdminPermission(admin, permission)) {
    throw Object.assign(new Error("ADMIN_PERMISSION_FORBIDDEN"), {
      status: 403,
      permission,
    });
  }
}

async function getDbBackedAdmin(
  user: AuthenticatedRequestUser,
): Promise<AdminRequestUser | null> {
  const result = await supabaseAdmin
    .from("admin_role_assignments")
    .select("id,user_id,role_key,permissions,status")
    .eq("user_id", user.userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (result.error) {
    if (isMissingRbacTable(result.error.message)) return null;
    throw result.error;
  }

  const row = result.data as null | {
    id: string;
    role_key: AdminRoleKey;
    permissions?: unknown;
  };
  if (!row) return null;
  const roleKey = (row.role_key || "viewer") as AdminRoleKey;
  return {
    ...user,
    adminBy: "db_role",
    adminSource: "db_role",
    roleKey,
    roleAssignmentId: row.id,
    permissions: unionPermissions(
      ADMIN_ROLE_PRESET_PERMISSIONS[roleKey] ?? ADMIN_ROLE_PRESET_PERMISSIONS.viewer,
      normalizePermissions(row.permissions),
    ),
  };
}

function getEnvBackedAdmin(user: AuthenticatedRequestUser): AdminRequestUser | null {
  const allowedUserIds = new Set(splitEnvList(process.env.ADMIN_USER_IDS));
  const allowedEmails = new Set(
    splitEnvList(process.env.ADMIN_EMAILS).map((item) => item.toLowerCase()),
  );

  if (allowedUserIds.has(user.userId)) {
    return {
      ...user,
      adminBy: "user_id",
      adminSource: "env_user_id",
      roleKey: "owner",
      roleAssignmentId: null,
      permissions: [...ALL_ADMIN_PERMISSIONS],
    };
  }

  if (user.email && allowedEmails.has(user.email.toLowerCase())) {
    return {
      ...user,
      adminBy: "email",
      adminSource: "env_email",
      roleKey: "owner",
      roleAssignmentId: null,
      permissions: [...ALL_ADMIN_PERMISSIONS],
    };
  }

  return null;
}

export async function getAdminUserFromRequest(
  req: Request,
  options: { permission?: AdminPermission } = {},
): Promise<AdminRequestUser> {
  const user = await getAuthUserFromRequest(req);
  const admin = (await getDbBackedAdmin(user)) ?? getEnvBackedAdmin(user);
  if (!admin) throw Object.assign(new Error("ADMIN_FORBIDDEN"), { status: 403 });
  if (options.permission) requireAdminPermission(admin, options.permission);
  return admin;
}

export async function writeAdminAudit(
  req: Request,
  input: {
    adminUserId: string;
    actionType: string;
    targetType?: string | null;
    targetId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
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
    return {
      body: { error: "請先登入後再進入管理功能。", build_tag: ADMIN_OPS_BUILD_TAG },
      status: 401,
    };
  }
  if (
    error?.message === "ADMIN_PERMISSION_FORBIDDEN" ||
    (error?.status === 403 && error?.permission)
  ) {
    return {
      body: {
        error: `此帳號缺少管理權限：${error.permission}`,
        code: "ADMIN_PERMISSION_FORBIDDEN",
        permission: error.permission,
        build_tag: ADMIN_OPS_BUILD_TAG,
      },
      status: 403,
    };
  }
  if (error?.message === "ADMIN_FORBIDDEN" || error?.status === 403) {
    return {
      body: {
        error:
          "此帳號沒有管理員權限。正式做法請建立 admin_role_assignments；短期 break-glass 可用 ADMIN_USER_IDS 或 ADMIN_EMAILS。",
        code: "ADMIN_FORBIDDEN",
        build_tag: ADMIN_OPS_BUILD_TAG,
      },
      status: 403,
    };
  }
  return {
    body: {
      error: error?.message || "Admin operation failed.",
      code: error?.code || "ADMIN_OPERATION_FAILED",
      build_tag: ADMIN_OPS_BUILD_TAG,
    },
    status: Number(error?.status || 500),
  };
}
