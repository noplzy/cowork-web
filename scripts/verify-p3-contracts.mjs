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
  "lib/p3Status.ts",
  "lib/server/buddySettlement.ts",
  "app/api/buddies/bookings/route.ts",
  "app/api/buddies/bookings/[bookingId]/route.ts",
  "app/api/buddies/bookings/[bookingId]/room/route.ts",
  "app/api/buddies/bookings/[bookingId]/completion/route.ts",
  "app/api/buddies/bookings/[bookingId]/settlement/route.ts",
  "app/api/buddies/bookings/[bookingId]/dispute/route.ts",
  "app/api/payments/ecpay/buddies/checkout/route.ts",
  "app/api/payments/ecpay/buddies/notify/route.ts",
  "app/api/account/buddies/payout-account/route.ts",
  "app/api/account/buddies/earnings/route.ts",
  "app/api/admin/buddies/payout-accounts/route.ts",
  "app/api/admin/buddies/payout-accounts/[accountId]/route.ts",
  "app/api/admin/buddies/settlements/route.ts",
  "app/api/admin/buddies/settlements/[settlementId]/route.ts",
  "app/api/admin/buddies/payout-batches/route.ts",
  "app/api/admin/buddies/payout-batches/[batchId]/route.ts",
  "app/api/admin/trust/buddies/disputes/[disputeId]/route.ts",
  "app/api/internal/buddies/settlement/cron/route.ts",
  "app/api/internal/launch/readiness/route.ts",
  "components/buddies/BuddyPaymentButton.tsx",
  "app/buddies/[serviceId]/page.tsx",
  "app/account/buddies/bookings/page.tsx",
  "app/account/buddies/earnings/page.tsx",
  "app/admin/buddies/settlements/page.tsx",
  "supabase/migrations/20260721143000_p3_buddies_settlement_trial.sql",
  "supabase/validation/P3_SUPABASE_SCHEMA_ACCEPTANCE_CHECK.sql",
  "supabase/validation/P3_SUPABASE_RUNTIME_ACCEPTANCE_CHECK.sql",
  "supabase/rollback/20260721143000_p3_buddies_settlement_trial_rollback.sql",
  ".env.p3.example",
  "docs/P3_VALIDATION_RUNBOOK.md",
  "docs/TRIAL_LAUNCH_CHECKLIST.md",
  "docs/P3_DEADLOCK_RECOVERY.md",
  "supabase/validation/P3_DEADLOCK_STATE_AND_BLOCKER_CHECK.sql",
];
for (const rel of requiredFiles) {
  check(`required file ${rel}`, fs.existsSync(path.join(root, rel)), rel);
}

includes("lib/p3Status.ts", [
  "remote_buddies_invite_trial_with_manual_verified_payout",
  "internal_settlement_ledger_not_legal_escrow",
  "raw_account_number_never_stored_in_application_database",
  "BUDDIES_COMMERCIAL_PILOT_ENABLED",
  "BUDDIES_PILOT_USER_IDS",
  "BUDDIES_ALLOW_IN_PERSON_PILOT",
  "BUDDIES_PLATFORM_FEE_BPS",
  "BUDDIES_PAYOUT_HOLD_HOURS",
  "P3_ECPAY_SMOKE_ACCEPTED",
  "P3_PAYOUT_SOP_ACCEPTED",
  "long_term_freeze",
]);

includes("app/api/payments/ecpay/buddies/checkout/route.ts", [
  "requireBuddiesRealNameVerifiedForRequest",
  "requireBuddiesCommercialPilot",
  "requireApprovedBuddyProvider",
  "buddy_booking_payment",
  "buddy_booking_id",
  "buddy_booking_payment_applications",
  "/api/payments/ecpay/buddies/notify",
  "CheckMacValue",
]);
includes("app/api/payments/ecpay/buddies/checkout/route.ts", [
  "BUDDY_PAYMENT_WINDOW_EXPIRED",
  ".upsert(",
  "checkout_retry_safe",
  '{ onConflict: "booking_id" }',
]);

includes("app/buddies/[serviceId]/page.tsx", [
  "BuddyPaymentButton",
  "建立預約並前往付款",
  "[1, 2].map",
  "開始前取消",
  "建立／進入履約房",
  "P3_BUILD_TAGS.buddiesCommercial",
]);

includes("app/api/payments/ecpay/buddies/notify/route.ts", [
  "verifyCheckMacValue",
  "queryEcpayTradeInfo",
  "tradeAmount !== Number(order.amount)",
  "ecpay_mark_order_paid",
  "applyBuddyPayment",
  "invoice_events",
  "buddy_payment_applied",
]);

includes("app/api/buddies/bookings/[bookingId]/room/route.ts", [
  "cowork_claim_buddy_room_provision_v3",
  "BUDDY_ROOM_TOO_EARLY",
  "createDailyPrivateRoom",
  "visibility: \"invited\"",
  "room_members",
  "cowork_finish_buddy_room_provision_v3",
  "private_room_short_lived_meeting_token",
]);

includes("lib/server/buddySettlement.ts", [
  "cowork_apply_buddy_payment_v3",
  "cowork_confirm_buddy_completion_v3",
  "cowork_hold_buddy_settlement_v3",
  "cowork_release_buddy_settlement_v3",
  "refund_requests",
  "service_issue",
]);

includes("app/api/buddies/bookings/[bookingId]/route.ts", [
  "booking.payment_status !== \"paid\"",
  "cowork_transition_buddy_booking_v3",
  "lazy_within_15_minutes_of_scheduled_start",
  "queueBuddyRefundIfPaid",
]);
excludes("app/api/buddies/bookings/[bookingId]/route.ts", [
  "BUDDIES_ALLOW_UNPAID_ACCEPT",
  "createDailyPrivateRoom",
]);

includes("app/api/buddies/bookings/[bookingId]/dispute/route.ts", [
  "holdBuddySettlement",
  "buddy_disputes",
  "support_tickets",
  "category: \"buddies\"",
]);

includes("app/api/admin/trust/buddies/disputes/[disputeId]/route.ts", [
  "permission: \"buddies.disputes\"",
  "cowork_resolve_buddy_dispute_v3",
  "settlement_resolution",
  "writeAdminAudit",
]);

includes("app/api/admin/buddies/payout-accounts/[accountId]/route.ts", [
  "permission: \"billing.manage\"",
  "vault|secure-ref|password-manager",
  "secure reference 不得包含完整銀行帳號",
  "writeAdminAudit",
]);

includes("app/api/admin/buddies/payout-batches/route.ts", [
  "cowork_create_buddy_payout_batch_v3",
  "permission: \"billing.manage\"",
]);
includes("app/api/admin/buddies/payout-batches/[batchId]/route.ts", [
  "cowork_transition_buddy_payout_batch_v3",
  "provider_reference",
]);
includes("app/admin/buddies/settlements/page.tsx", [
  "mark_processing",
  "確認已轉帳",
  "provider_reference",
  "標記失敗",
]);

const sql = file("supabase/migrations/20260721143000_p3_buddies_settlement_trial.sql");
for (const table of [
  "buddy_booking_payment_applications",
  "buddy_settlements",
  "buddy_settlement_events",
  "buddy_payout_accounts",
  "buddy_payout_batches",
  "buddy_payout_items",
]) {
  check(`migration creates ${table}`, sql.includes(`create table if not exists public.${table}`));
  check(`migration enables RLS ${table}`, sql.includes(`alter table public.${table} enable row level security`));
  check(`migration revokes browser ${table}`, sql.includes(`revoke all on table public.${table} from public, anon, authenticated`));
}
for (const rpc of [
  "cowork_create_buddy_booking_v3",
  "cowork_apply_buddy_payment_v3",
  "cowork_transition_buddy_booking_v3",
  "cowork_confirm_buddy_completion_v3",
  "cowork_claim_buddy_room_provision_v3",
  "cowork_finish_buddy_room_provision_v3",
  "cowork_hold_buddy_settlement_v3",
  "cowork_release_buddy_settlement_v3",
  "cowork_reverse_buddy_payment_v3",
  "cowork_resolve_buddy_dispute_v3",
  "cowork_promote_buddy_settlements_v3",
  "cowork_create_buddy_payout_batch_v3",
  "cowork_transition_buddy_payout_batch_v3",
]) {
  check(`migration creates ${rpc}`, sql.includes(`function public.${rpc}`));
  check(`migration grants ${rpc} only to service_role`, sql.includes(`grant execute on function public.${rpc}`));
}

check("migration uses staged transactions", (sql.match(/\nbegin;/gi) || []).length >= 6 && (sql.match(/\ncommit;/gi) || []).length >= 6);
check("migration has lock timeout", sql.includes("set lock_timeout = '15s'"));
check("migration isolates hot tables", sql.includes("Stage 2: payment_orders") && sql.includes("Stage 3: buddy_bookings") && sql.includes("Stage 4: billing_ledger"));
check("P3 default hold is 72 hours", file("lib/p3Status.ts").includes('envInt("BUDDIES_PAYOUT_HOLD_HOURS", 72') && file(".env.p3.example").includes("BUDDIES_PAYOUT_HOLD_HOURS=72"));
check("migration labels internal ledger not legal escrow", sql.includes("Not legal escrow"));
check("migration raw bank safety check", sql.includes("secure_provider_reference is null or secure_provider_reference !~ '[0-9]{8,}'"));
check("migration has two-party completion", sql.includes("buyer_completed_at is not null and v_booking.provider_completed_at is not null"));
check("migration blocks early completion", sql.includes("BUDDY_COMPLETION_TOO_EARLY"));
check("migration routes started cancellation to dispute", sql.includes("BUDDY_CANCELLATION_REQUIRES_DISPUTE"));
check("migration has payout hold period", sql.includes("available_for_payout_at=now() + make_interval"));
check("migration blocks remote-only violation", sql.includes("P3_REMOTE_ONLY"));
check("migration has refund reversal trigger", sql.includes("trg_p3_buddy_refund_reversal"));
check("migration supports dispute hold", sql.includes("status='dispute_hold'"));
check("migration protects payout with verified account", sql.includes("VERIFIED_PAYOUT_ACCOUNT_REQUIRED"));
check("migration extends billing ledger types", sql.includes("buddy_provider_payable_reversal"));

const schemaCheck = file("supabase/validation/P3_SUPABASE_SCHEMA_ACCEPTANCE_CHECK.sql");
check("schema acceptance has PASS summary", schemaCheck.includes("P3_SUPABASE_SCHEMA_ACCEPTANCE"));
check("schema acceptance has no temporary table", !/temporary table|create temp/i.test(schemaCheck));
check("schema acceptance checks no raw bank column", schemaCheck.includes("raw bank account column"));

const runtimeCheck = file("supabase/validation/P3_SUPABASE_RUNTIME_ACCEPTANCE_CHECK.sql");
check("runtime checks duplicate settlement", runtimeCheck.includes("having count(*)>1"));
check("runtime checks no payout before two-party completion", runtimeCheck.includes("buyer_completed_at is null"));
check("runtime checks open dispute payout block", runtimeCheck.includes("dispute_status in ('open','reviewing')"));

includes("app/api/internal/launch/readiness/route.ts", [
  "ready_for_invite_trial",
  "p3AllAttestationsAccepted",
  "no_manual_review_settlements",
  "no_failed_payout_items",
  "remote_only",
]);
includes("vercel.json", ["/api/internal/buddies/settlement/cron"]);
includes("package.json", ["verify:p3-contracts", "verify:p3-production"]);
includes("lib/releaseInfo.ts", [
  "calmco-p3-buddies-settlement-trial-v131-2026-07-21",
  "remote_buddies_invite_trial_manual_verified_payout",
  "legal_escrow_claimed: false",
  "raw_bank_account_in_application_db: false",
  "ai_enabled: false",
]);

if (failures.length) {
  console.error(`P3 contract verification FAILED: ${failures.length}/${checks.length}`);
  for (const failure of failures) console.error(`- ${failure.name}: ${failure.detail}`);
  process.exit(1);
}
console.log(`P3 contract verification PASS: ${checks.length}/${checks.length}`);
