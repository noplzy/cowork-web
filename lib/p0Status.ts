export const P0_BUILD_TAGS = {
  package: "calmco-p0-pricing-v2-v128-2026-07-18",
  presence: "room-presence-state-closure-v128-2026-07-18",
  summary: "room-post-session-summary-v128-2026-07-18",
  pricing: "product-catalog-pricing-v128-final-no-ai-p0-2026-07-18",
  migration: "20260718193000_p0_presence_summary_pricing_v2",
  meetingToken: "daily-meeting-token-p0-safe-media-v128-2026-07-18",
  roomInfra: "formal-room-lifecycle-p0-v128-2026-07-18",
  contracts: "p0-contracts-v128-42",
} as const;

export const P0_IMPLEMENTATION_STATUS = {
  productionSourceAlignment: "implemented_requires_deployment_verification",
  presenceStateClosure: "implemented_requires_sql_and_runtime_smoke",
  roomPostSessionSummary: "implemented_requires_cron_and_runtime_smoke",
  pricingV2: "final_spec_not_purchasable",
  ai: "long_term_freeze",
} as const;
