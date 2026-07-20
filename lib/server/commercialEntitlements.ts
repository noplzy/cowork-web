import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { P2_BUILD_TAGS, isRooms299ServerPilotEnabled } from "@/lib/p2Status";

export const COMMERCIAL_ENTITLEMENTS_BUILD_TAG = P2_BUILD_TAGS.entitlement;

export type CommercialPlanCode =
  | "rooms_unlimited_299"
  | "buddies_pro_399"
  | "whole_site_599"
  | "host_999";

export type WalletSnapshot = {
  id: string;
  resourceKey: string;
  unit: string;
  granted: number;
  consumed: number;
  overage: number;
  remaining: number;
  periodStart: string;
  periodEnd: string;
};

export type CommercialEntitlementSnapshot = {
  userId: string;
  planCode: string;
  validUntil: string | null;
  status: string;
  billingMode: "free" | "one_time" | "subscription";
  roomsEntitled: boolean;
  legacyVip: boolean;
  commercialPlan: boolean;
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
  visualWallet: WalletSnapshot | null;
  extensionWallet: WalletSnapshot | null;
  buildTag: string;
};

function activeUntil(value: unknown) {
  if (!value) return true;
  const time = new Date(String(value)).getTime();
  return Number.isFinite(time) && time > Date.now();
}

export function planIncludesRooms(planCode: string | null | undefined) {
  return [
    "vip",
    "vip_month",
    "rooms_unlimited_299",
    "whole_site_599",
    "host_999",
  ].includes(String(planCode || ""));
}

function toWallet(row: any | null): WalletSnapshot | null {
  if (!row) return null;
  const granted = Math.max(0, Number(row.granted_quantity || 0));
  const consumed = Math.max(0, Number(row.consumed_quantity || 0));
  return {
    id: String(row.id),
    resourceKey: String(row.resource_key),
    unit: String(row.unit),
    granted,
    consumed,
    overage: Math.max(0, Number(row.overage_quantity || 0)),
    remaining: Math.max(0, granted - consumed),
    periodStart: String(row.period_start),
    periodEnd: String(row.period_end),
  };
}

export async function getCommercialEntitlementSnapshot(
  userId: string,
): Promise<CommercialEntitlementSnapshot> {
  const nowIso = new Date().toISOString();
  const [commercial, legacy] = await Promise.all([
    supabaseAdmin
      .from("user_plan_entitlements")
      .select(
        "id,user_id,plan_code,status,valid_from,valid_until,auto_renew,cancel_at_period_end,source_subscription_profile_id,source_payment_order_id,updated_at",
      )
      .eq("user_id", userId)
      .in("status", ["active", "cancel_pending"])
      .lte("valid_from", nowIso)
      .gt("valid_until", nowIso)
      .order("valid_until", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("user_entitlements")
      .select("plan,vip_until")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (commercial.error && !/relation .*user_plan_entitlements.* does not exist/i.test(commercial.error.message)) {
    throw commercial.error;
  }
  if (legacy.error) throw legacy.error;

  const commercialRow = commercial.data as any | null;
  const legacyPlan = String(legacy.data?.plan || "free");
  const legacyVip = planIncludesRooms(legacyPlan) && activeUntil(legacy.data?.vip_until);
  const planCode = commercialRow?.plan_code
    ? String(commercialRow.plan_code)
    : legacyVip
      ? legacyPlan
      : "free";

  let visualWallet: WalletSnapshot | null = null;
  let extensionWallet: WalletSnapshot | null = null;
  if (commercialRow) {
    const wallets = await supabaseAdmin
      .from("user_usage_wallets")
      .select(
        "id,user_id,plan_code,resource_key,unit,period_start,period_end,granted_quantity,consumed_quantity,overage_quantity,status",
      )
      .eq("user_id", userId)
      .eq("plan_code", commercialRow.plan_code)
      .eq("status", "active")
      .lte("period_start", nowIso)
      .gt("period_end", nowIso)
      .in("resource_key", ["visual_seconds", "extension_points"]);
    if (wallets.error) throw wallets.error;
    visualWallet = toWallet(
      (wallets.data || []).find((row: any) => row.resource_key === "visual_seconds") || null,
    );
    extensionWallet = toWallet(
      (wallets.data || []).find((row: any) => row.resource_key === "extension_points") || null,
    );
  }

  return {
    userId,
    planCode,
    validUntil: commercialRow?.valid_until || legacy.data?.vip_until || null,
    status: commercialRow?.status || (legacyVip ? "active" : "free"),
    billingMode: commercialRow ? "subscription" : legacyVip ? "one_time" : "free",
    roomsEntitled: commercialRow
      ? planIncludesRooms(commercialRow.plan_code)
      : legacyVip,
    legacyVip: !commercialRow && legacyVip,
    commercialPlan: Boolean(commercialRow),
    autoRenew: Boolean(commercialRow?.auto_renew),
    cancelAtPeriodEnd: Boolean(commercialRow?.cancel_at_period_end),
    visualWallet,
    extensionWallet,
    buildTag: COMMERCIAL_ENTITLEMENTS_BUILD_TAG,
  };
}

export async function requireRoomsCreationEntitlement(userId: string) {
  const snapshot = await getCommercialEntitlementSnapshot(userId);
  if (!snapshot.roomsEntitled) {
    throw Object.assign(new Error("ROOM_CREATION_REQUIRES_ROOMS_PLAN"), {
      status: 402,
      snapshot,
    });
  }
  return snapshot;
}

export async function consumeVisualSeconds(input: {
  userId: string;
  roomId: string;
  accessSessionId?: string | null;
  quantitySeconds: number;
  idempotencyKey: string;
  intervalMediaClass: string;
}) {
  const snapshot = await getCommercialEntitlementSnapshot(input.userId);
  const quantity = Math.max(0, Math.min(Math.trunc(input.quantitySeconds), 90));

  if (
    quantity === 0 ||
    input.intervalMediaClass !== "video" ||
    snapshot.planCode !== "rooms_unlimited_299"
  ) {
    return {
      applied: false,
      allowed: true,
      downgradeRequired: false,
      reason: quantity === 0 ? "no_countable_delta" : "wallet_not_applicable",
      snapshot,
      buildTag: P2_BUILD_TAGS.wallet,
    };
  }

  const result = await supabaseAdmin.rpc("cowork_consume_usage_wallet_v2", {
    p_user_id: input.userId,
    p_resource_key: "visual_seconds",
    p_quantity: quantity,
    p_idempotency_key: input.idempotencyKey,
    p_room_id: input.roomId,
    p_access_session_id: input.accessSessionId || null,
    p_payment_order_id: null,
    p_allow_overage: true,
    p_metadata: {
      source: "room_presence_v130",
      interval_media_class: input.intervalMediaClass,
      build_tag: P2_BUILD_TAGS.wallet,
    },
  });
  if (result.error) throw result.error;

  const payload = (result.data || {}) as any;
  const consumed = Math.max(0, Number(payload.consumed_quantity || 0));
  const overage = Math.max(0, Number(payload.overage_quantity || 0));
  if (input.accessSessionId && (consumed > 0 || overage > 0)) {
    const current = await supabaseAdmin
      .from("room_access_sessions")
      .select("wallet_visual_debited_seconds,wallet_visual_overage_seconds")
      .eq("id", input.accessSessionId)
      .eq("user_id", input.userId)
      .maybeSingle();
    if (!current.error && current.data) {
      await supabaseAdmin
        .from("room_access_sessions")
        .update({
          commercial_plan_code: snapshot.planCode,
          wallet_visual_debited_seconds:
            Number(current.data.wallet_visual_debited_seconds || 0) + consumed,
          wallet_visual_overage_seconds:
            Number(current.data.wallet_visual_overage_seconds || 0) + overage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.accessSessionId)
        .eq("user_id", input.userId);
    }
  }

  const allowed = payload.allowed === true;
  return {
    applied: true,
    allowed,
    downgradeRequired: !allowed || overage > 0 || Number(payload.remaining_quantity || 0) <= 0,
    consumedSeconds: consumed,
    overageSeconds: overage,
    remainingSeconds: Math.max(0, Number(payload.remaining_quantity || 0)),
    walletId: payload.wallet_id || null,
    eventId: payload.event_id || null,
    idempotent: payload.idempotent === true,
    snapshot,
    buildTag: P2_BUILD_TAGS.wallet,
  };
}

export async function finalizeCommercialRoomExtension(input: {
  roomId: string;
  sponsorUserId: string;
  extensionWindowKey: string;
  idempotencyKey: string;
}) {
  if (!isRooms299ServerPilotEnabled()) {
    throw Object.assign(new Error("P2_ROOMS_299_COMMERCIAL_DISABLED"), {
      status: 503,
    });
  }

  const result = await supabaseAdmin.rpc("cowork_finalize_room_extension_v2", {
    p_room_id: input.roomId,
    p_sponsor_user_id: input.sponsorUserId,
    p_extension_window_key: input.extensionWindowKey,
    p_idempotency_key: input.idempotencyKey,
    p_metadata: {
      source: "commercial_extension_route_v130",
      build_tag: P2_BUILD_TAGS.extension,
    },
  });
  if (result.error) throw result.error;
  return result.data as Record<string, unknown>;
}

export async function getRoomCommercialState(roomId: string, userId: string) {
  const [snapshot, grants] = await Promise.all([
    getCommercialEntitlementSnapshot(userId),
    supabaseAdmin
      .from("room_extension_grants")
      .select(
        "id,room_id,extension_window_key,sponsor_user_id,beneficiary_user_ids,points_consumed,requested_extension_minutes,previous_scheduled_end_at,new_scheduled_end_at,status,created_at",
      )
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  if (grants.error && !/relation .*room_extension_grants.* does not exist/i.test(grants.error.message)) {
    throw grants.error;
  }
  return {
    entitlement: snapshot,
    extensionGrants: grants.data || [],
    serverPilotEnabled: isRooms299ServerPilotEnabled(),
    buildTag: P2_BUILD_TAGS.entitlement,
  };
}
