import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const checks = [];
const failures = [];

function file(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) throw new Error(`Missing file: ${rel}`);
  return fs.readFileSync(full, "utf8");
}

function check(name, passed, detail = "") {
  checks.push({ name, passed, detail });
  if (!passed) failures.push({ name, detail });
}

function includes(rel, tokens) {
  const content = file(rel);
  for (const token of tokens) {
    check(`${rel} contains ${token}`, content.includes(token), token);
  }
}

function excludes(rel, tokens) {
  const content = file(rel);
  for (const token of tokens) {
    check(`${rel} excludes ${token}`, !content.includes(token), token);
  }
}

const requiredFiles = [
  "lib/p4bStatus.ts",
  "lib/buddyWorkspaceTypes.ts",
  "lib/server/buddyOperationalWorkspace.ts",
  "app/api/account/buddies/workspace/route.ts",
  "components/buddies/BuddyOperationalWorkspace.tsx",
  "components/buddies/BuddyOperationalWorkspace.module.css",
  "app/account/buddies/workspace/page.tsx",
  "app/account/buddies/bookings/page.tsx",
  "app/account/buddies/earnings/page.tsx",
  "components/formalOps/FormalOpsShell.tsx",
  "lib/releaseInfo.ts",
  "supabase/migrations/20260724193000_p4b_buddies_operational_workspaces.sql",
  "supabase/validation/P4B_SUPABASE_SCHEMA_ACCEPTANCE_CHECK.sql",
  "supabase/validation/P4B_SUPABASE_RUNTIME_ACCEPTANCE_CHECK.sql",
  "supabase/rollback/20260724193000_p4b_buddies_operational_workspaces_rollback.sql",
  "docs/P4B_VALIDATION_RUNBOOK.md",
];

for (const rel of requiredFiles) {
  check(`required file ${rel}`, fs.existsSync(path.join(root, rel)), rel);
}

includes("lib/p4bStatus.ts", [
  "calmco-p4b-buddies-operational-workspaces-v141-2026-07-24",
  "buddies-operational-workspace-v141-2026-07-24",
  "reuses_existing_p3_ecpay_checkout_and_notify",
  "manual_verified_only_no_automated_bank_adapter",
  "buddies399: \"not_enabled_by_p4b\"",
]);

includes("lib/server/buddyOperationalWorkspace.ts", [
  "buddy_bookings",
  "buddy_settlements",
  "buddy_disputes",
  "buddy_settlement_events",
  "buddy_payout_accounts",
  "buddy_payout_items",
  "ROOM_EARLY_MINUTES = 15",
  "ROOM_LATE_MINUTES = 15",
  "service_role",
]);

includes("app/api/account/buddies/workspace/route.ts", [
  "requireBuddiesRealNameVerifiedForRequest",
  "getBuddyOperationalWorkspace",
  '"Cache-Control": "no-store"',
  "P4B_BUILD_TAGS.workspace",
]);

includes("components/buddies/BuddyOperationalWorkspace.tsx", [
  "我的預約工作台",
  "安感夥伴工作台",
  "收益與人工撥款",
  "BuddyPaymentButton",
  "/api/buddies/bookings/${bookingId}",
  "/api/buddies/bookings/${bookingId}/room",
  "/api/buddies/bookings/${disputeBookingId}/dispute",
  "/api/account/buddies/payout-account",
  "完整帳號只透過指定安全管道提供",
  "data-p4b-build",
]);

excludes("components/buddies/BuddyOperationalWorkspace.tsx", [
  "SUPABASE_SERVICE_ROLE_KEY",
  "service_role",
  "完整銀行帳號：",
]);

includes("components/formalOps/FormalOpsShell.tsx", [
  '["/account/buddies/workspace", "Buddies 工作台"]',
  '["/account/buddies/earnings", "Buddies 收益"]',
]);

includes("lib/releaseInfo.ts", [
  "P4B_BUILD_TAGS",
  "P4B_IMPLEMENTATION_STATUS",
  "calmco-p4b-buddies-operational-workspaces-v141-2026-07-24",
  "/api/account/buddies/workspace",
  "new_payment_command_path: false",
  "automated_bank_payout: false",
]);

includes("package.json", [
  '"verify:p4b-contracts"',
  '"verify:p4b-production"',
]);

const migration = file(
  "supabase/migrations/20260724193000_p4b_buddies_operational_workspaces.sql",
);
for (const index of [
  "idx_p4b_buddy_bookings_buyer_schedule",
  "idx_p4b_buddy_bookings_provider_schedule",
  "idx_p4b_buddy_services_provider_status",
  "idx_p4b_buddy_slots_provider_schedule",
  "idx_p4b_buddy_disputes_booking_status",
  "idx_p4b_settlement_events_booking_created",
]) {
  check(`migration creates ${index}`, migration.includes(index), index);
}
check(
  "migration does not create payment or settlement command RPC",
  !/create\s+(or\s+replace\s+)?function\s+public\.(cowork_(apply_buddy_payment|transition_buddy_booking|release_buddy_settlement))/i.test(
    migration,
  ),
);
check(
  "migration does not grant browser table access",
  !/grant\s+.*\s+to\s+(anon|authenticated)/i.test(migration),
);

const schemaCheck = file(
  "supabase/validation/P4B_SUPABASE_SCHEMA_ACCEPTANCE_CHECK.sql",
);
check(
  "schema acceptance has PASS summary",
  schemaCheck.includes("P4B_SUPABASE_SCHEMA_ACCEPTANCE"),
);
check(
  "schema acceptance does not create temp table",
  !/create\s+(temporary|temp)\s+table/i.test(schemaCheck),
);

const runtimeCheck = file(
  "supabase/validation/P4B_SUPABASE_RUNTIME_ACCEPTANCE_CHECK.sql",
);
check(
  "runtime acceptance checks duplicate active disputes",
  runtimeCheck.includes("duplicate_active_disputes"),
);
check(
  "runtime acceptance checks settlement amount integrity",
  runtimeCheck.includes("settlement_amount_mismatch"),
);
check(
  "runtime acceptance checks raw account safety",
  runtimeCheck.includes("raw_account_number_like_value"),
);

console.log(
  JSON.stringify(
    {
      ok: failures.length === 0,
      build_tag: "p4b-contracts-v141",
      passed: checks.length - failures.length,
      total: checks.length,
      failures,
    },
    null,
    2,
  ),
);

if (failures.length) process.exit(1);
