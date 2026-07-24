export const P4B_BUILD_TAGS = {
  package: "calmco-p4b-buddies-operational-workspaces-v141-2026-07-24",
  workspace: "buddies-operational-workspace-v141-2026-07-24",
  buyer: "buddies-buyer-workspace-v141-2026-07-24",
  provider: "buddies-provider-workspace-v141-2026-07-24",
  payout: "buddies-payout-workspace-v141-2026-07-24",
  ui: "buddies-operational-ui-v141-2026-07-24",
  migration: "20260724193000_p4b_buddies_operational_workspaces",
  contracts: "p4b-contracts-v141",
} as const;

export const P4B_IMPLEMENTATION_STATUS = {
  scope: "buddies_buyer_provider_and_payout_operational_workspaces",
  dependency: "p3_remote_buddies_commercial_and_manual_verified_payout",
  buyerWorkspace: "implemented_role_aware_next_step_and_safe_existing_actions",
  providerWorkspace: "implemented_requests_upcoming_services_slots_and_completion_state",
  payoutWorkspace: "implemented_settlement_summary_account_status_and_manual_review_flow",
  readModel: "implemented_server_side_aggregation_without_new_commercial_command_path",
  paymentCommands: "reuses_existing_p3_ecpay_checkout_and_notify",
  bookingCommands: "reuses_existing_p3_transition_room_completion_and_dispute_routes",
  payoutMode: "manual_verified_only_no_automated_bank_adapter",
  inPersonCommercial: "blocked_for_trial",
  buddies399: "not_enabled_by_p4b",
  wholeSite599: "not_enabled_by_p4b",
  host999: "not_enabled_by_p4b",
  ai: "long_term_freeze",
} as const;
