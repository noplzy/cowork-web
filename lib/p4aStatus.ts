export const P4A_BUILD_TAGS = {
  package: "calmco-p4a-rooms-operational-ux-v140-2026-07-24",
  operations: "room-operational-snapshot-v140-2026-07-24",
  dailyIdentity: "daily-room-user-identity-v140-2026-07-24",
  relationships: "room-relationship-actions-v140-2026-07-24",
  moderation: "room-moderation-actions-v140-2026-07-24",
  ownerControls: "room-owner-controls-v140-2026-07-24",
  ui: "room-operational-dock-v140-2026-07-24",
  migration: "20260724143000_p4a_rooms_operational_ux",
  contracts: "p4a-contracts-v140",
} as const;

export const P4A_IMPLEMENTATION_STATUS = {
  scope: "rooms_operational_readability_social_safety_and_owner_controls",
  serverAuthoritativeCountdown: "implemented_from_scheduled_end_at_and_server_now",
  dailyUserIdentity: "implemented_meeting_token_user_id_requires_fresh_tokens",
  roomRoster: "implemented_safe_server_projection_with_presence_and_profiles",
  friendships: "implemented_room_scoped_atomic_rpc",
  publicProfiles: "implemented_existing_public_profile_route_linked_from_room",
  reports: "implemented_room_membership_validated_report_route",
  blocks: "uses_existing_safety_block_route_then_removes_relationship",
  ownerRemove: "client_daily_eject_then_server_membership_revocation",
  ownerEnd: "server_room_end_and_daily_room_delete",
  wallets: "implemented_existing_p2_entitlement_projection",
  mobileInformationArchitecture: "implemented_compact_status_bar_and_drawer",
  ai: "long_term_freeze",
} as const;
