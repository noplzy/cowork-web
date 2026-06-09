import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const FORMAL_OPS_BUILD_TAG = "formal-ops-foundation-2026-06-02";

export type SafetyTargetType =
  | "user"
  | "room"
  | "buddy_service"
  | "buddy_booking"
  | "payment_order"
  | "ai"
  | "other";

export function cleanText(input: unknown, maxLength: number) {
  return String(input ?? "").trim().slice(0, maxLength);
}

export function getClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip") || null;
}

function isMissingUserBlocksSafetySchema(message?: string | null) {
  const text = String(message || "");
  return (
    /relation .*user_blocks.* does not exist/i.test(text) ||
    /column .*user_blocks\.(id|blocker_user_id|blocked_user_id).* does not exist/i.test(text) ||
    /Could not find the '(id|blocker_user_id|blocked_user_id)' column/i.test(text)
  );
}

/**
 * Relationship block safety gate.
 *
 * Important:
 * - The production user_blocks table may not have an `id` column because an older
 *   account-security block table existed first.
 * - Room join must not hard-crash because of a non-essential select column.
 * - This function only needs to know whether either side blocked the other, so
 *   it selects relationship columns instead of `id`.
 */
export async function userBlockExists(userA: string, userB: string) {
  if (!userA || !userB || userA === userB) return false;

  const { data, error } = await supabaseAdmin
    .from("user_blocks")
    .select("blocker_user_id,blocked_user_id")
    .or(
      `and(blocker_user_id.eq.${userA},blocked_user_id.eq.${userB}),and(blocker_user_id.eq.${userB},blocked_user_id.eq.${userA})`
    )
    .limit(1);

  if (error) {
    // If the relationship-block migration has not been applied, do not crash
    // legacy room entry. The room route still returns build_tag for diagnosis.
    if (isMissingUserBlocksSafetySchema(error.message)) {
      console.warn("[USER_BLOCKS_SAFETY_SCHEMA_SOFT_SKIP]", error.message);
      return false;
    }

    throw error;
  }

  return (data ?? []).length > 0;
}

export async function insertAdminAuditLog(input: {
  actorAdminUserId?: string | null;
  actionType: string;
  targetType?: string | null;
  targetId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("admin_audit_logs").insert({
    actor_admin_user_id: input.actorAdminUserId ?? null,
    action_type: input.actionType,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
    metadata: input.metadata ?? {},
  });

  if (error && !/relation .*admin_audit_logs.* does not exist/i.test(error.message)) {
    console.error("[ADMIN_AUDIT_INSERT_ERROR]", error.message);
  }
}

export async function insertReliabilityEvent(input: {
  userId?: string | null;
  roomId?: string | null;
  eventType: string;
  severity?: "info" | "low" | "normal" | "high" | "critical";
  source?: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("reliability_events").insert({
    user_id: input.userId ?? null,
    room_id: input.roomId ?? null,
    event_type: input.eventType,
    severity: input.severity ?? "info",
    source: input.source ?? "system",
    metadata: input.metadata ?? {},
  });

  if (error && !/relation .*reliability_events.* does not exist/i.test(error.message)) {
    console.error("[RELIABILITY_EVENT_INSERT_ERROR]", error.message);
  }
}
