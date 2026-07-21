export const P3_BUILD_TAGS = {
  package: "calmco-p3-buddies-settlement-trial-v1311-2026-07-22",
  buddiesCommercial: "buddies-commercial-pilot-v1311-2026-07-22",
  settlement: "buddy-settlement-ledger-v1311-2026-07-22",
  checkout: "ecpay-buddy-checkout-v1311-2026-07-22",
  notify: "ecpay-buddy-notify-v1311-2026-07-22",
  payout: "buddy-manual-payout-v1311-2026-07-22",
  launchGate: "invite-trial-launch-gate-v1311-2026-07-22",
  migration: "20260721143000_p3_buddies_settlement_trial",
  contracts: "p3-contracts-v1311",
} as const;

export const P3_IMPLEMENTATION_STATUS = {
  scope: "remote_buddies_invite_trial_with_manual_verified_payout",
  bookingPayment: "implemented_feature_gated_requires_real_ecpay_smoke",
  fundsHolding: "internal_settlement_ledger_not_legal_escrow",
  completion: "two_party_confirmation_then_hold_period",
  disputes: "payout_hold_with_release_or_full_refund_resolution",
  payout: "verified_manual_batch_requires_out_of_band_secure_bank_details",
  providerBankData: "raw_account_number_never_stored_in_application_database",
  inPersonHybrid: "blocked_for_trial",
  buddies399: "still_blocked_until_waitlist_tracking_exposure_benefits_exist",
  wholeSite599: "still_blocked_until_buddies399_entitlements_exist",
  host999: "still_blocked_until_host_controls",
  ai: "long_term_freeze",
} as const;

export function envFlag(name: string) {
  return ["1", "true", "yes", "enabled"].includes(
    String(process.env[name] || "").trim().toLowerCase(),
  );
}

function envInt(name: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(process.env[name] || ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function isBuddiesCommercialPilotEnabled() {
  return envFlag("BUDDIES_COMMERCIAL_PILOT_ENABLED");
}

export function isBuddiesPublicPilotEnabled() {
  return envFlag("NEXT_PUBLIC_BUDDIES_COMMERCIAL_PILOT_ENABLED");
}

export function isBuddiesRemoteOnlyPilot() {
  return !envFlag("BUDDIES_ALLOW_IN_PERSON_PILOT");
}

export function buddiesPlatformFeeBps() {
  return envInt("BUDDIES_PLATFORM_FEE_BPS", 2000, 0, 5000);
}

export function buddiesPayoutHoldHours() {
  return envInt("BUDDIES_PAYOUT_HOLD_HOURS", 72, 0, 720);
}

export function buddiesMaxBookingAmountTwd() {
  return envInt("BUDDIES_MAX_BOOKING_AMOUNT_TWD", 20000, 100, 200000);
}

export function buddiesMaxBookingHours() {
  return envInt("BUDDIES_MAX_BOOKING_HOURS", 2, 1, 2);
}

export function buddiesPayoutMode() {
  return String(process.env.BUDDIES_PAYOUT_MODE || "manual_verified").trim();
}

export function isPilotUserAllowed(userId: string) {
  if (envFlag("BUDDIES_PILOT_OPEN_TO_VERIFIED")) return true;
  const allowed = new Set(
    String(process.env.BUDDIES_PILOT_USER_IDS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  return allowed.has(userId);
}

export function p3AttestationFlags() {
  return {
    p0_production_accepted: envFlag("P0_PRODUCTION_ACCEPTED"),
    p1_production_accepted: envFlag("P1_PRODUCTION_ACCEPTED"),
    p2_production_accepted: envFlag("P2_PRODUCTION_ACCEPTED"),
    p3_schema_accepted: envFlag("P3_SCHEMA_ACCEPTED"),
    p3_ecpay_smoke_accepted: envFlag("P3_ECPAY_SMOKE_ACCEPTED"),
    p3_payout_sop_accepted: envFlag("P3_PAYOUT_SOP_ACCEPTED"),
    p3_support_oncall_accepted: envFlag("P3_SUPPORT_ONCALL_ACCEPTED"),
  };
}

export function p3AllAttestationsAccepted() {
  return Object.values(p3AttestationFlags()).every(Boolean);
}
