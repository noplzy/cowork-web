export const P1_BUILD_TAGS = {
  package: "calmco-p1-trust-operations-v129-2026-07-18",
  permissions: "admin-rbac-permission-closure-v129-2026-07-18",
  stateMachine: "trust-operations-state-machine-v129-2026-07-18",
  appeals: "appeals-lifecycle-v129-2026-07-18",
  migration: "20260718223000_p1_trust_operations_appeals",
  contracts: "p1-contracts-v129-68",
} as const;

export const P1_IMPLEMENTATION_STATUS = {
  supportPermissionClosure: "implemented_requires_role_matrix_smoke",
  safetyPermissionClosure: "implemented_requires_role_matrix_smoke",
  moderationStateMachine: "implemented_requires_runtime_smoke",
  appealsLifecycle: "implemented_requires_sql_and_runtime_smoke",
  schemaReleaseReadiness: "implemented_requires_production_alias_and_sha_verification",
} as const;
