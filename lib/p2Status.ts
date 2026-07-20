export const P2_BUILD_TAGS = {
  package: "calmco-p2-rooms-299-commercial-v130-2026-07-20",
  catalog: "product-catalog-rooms-299-pilot-v130-2026-07-20",
  entitlement: "commercial-entitlements-v130-2026-07-20",
  wallet: "commercial-usage-wallet-v130-2026-07-20",
  recurringCheckout: "ecpay-recurring-checkout-rooms-299-v130-2026-07-20",
  recurringNotify: "ecpay-recurring-notify-rooms-299-v130-2026-07-20",
  extension: "room-commercial-extension-v130-2026-07-20",
  meetingToken: "daily-meeting-token-commercial-entitlement-v130-2026-07-20",
  migration: "20260720123000_p2_rooms_299_commercial_closure",
  contracts: "p2-contracts-v130-103",
} as const;

export const P2_IMPLEMENTATION_STATUS = {
  scope: "rooms_299_controlled_commercial_pilot",
  rooms299Entitlement: "implemented_requires_sql_and_paid_callback_smoke",
  visualWallet: "implemented_requires_real_presence_smoke",
  extensionWallet: "implemented_one_extension_per_room_pilot",
  recurringCheckout: "implemented_server_and_public_feature_gated",
  cancellation: "cancel_at_period_end_preserves_current_period",
  fullRefundReversal: "implemented_service_role_rpc_and_refund_status_trigger",
  partialRefundReversal: "manual_review_required",
  buddies399: "blocked_until_p3_settlement",
  wholeSite599: "blocked_until_p3_settlement",
  host999: "blocked_until_p3_settlement_and_host_controls",
  extensionPointAddOns: "blocked_until_add_on_checkout_and_refund_allocation_e2e",
  ai: "long_term_freeze",
} as const;

export function isEnabledFlag(value: string | undefined | null) {
  return ["1", "true", "yes", "enabled"].includes(
    String(value || "").trim().toLowerCase(),
  );
}

export function isRooms299PublicPilotEnabled() {
  return isEnabledFlag(
    process.env.NEXT_PUBLIC_PRICING_V2_ROOMS_299_ENABLED,
  );
}

export function isRooms299ServerPilotEnabled() {
  return (
    isEnabledFlag(process.env.PRICING_V2_COMMERCIAL_ENABLED) &&
    isEnabledFlag(process.env.PRICING_V2_ROOMS_299_ENABLED)
  );
}

export function isP2RoomCreationGateEnabled() {
  return isEnabledFlag(process.env.PRICING_V2_ROOM_CREATION_GATE_ENABLED);
}
