#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const results = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function check(name, ok, detail = "") {
  results.push({ check: name, status: ok ? "PASS" : "FAIL", detail });
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function includes(rel, needle) {
  return exists(rel) && read(rel).includes(needle);
}

function excludes(rel, needle) {
  return exists(rel) && !read(rel).includes(needle);
}

const requiredFiles = [
  "lib/p2Status.ts",
  "lib/server/commercialEntitlements.ts",
  "lib/productCatalog.ts",
  "lib/billingPlans.ts",
  "lib/serverRoomUtils.ts",
  "lib/server/roomInfra.ts",
  "lib/server/roomPresence.ts",
  "components/billing/PricingCheckoutButton.tsx",
  "components/rooms/RoomLifecycleBridge.tsx",
  "app/pricing/page.tsx",
  "app/account/subscriptions/page.tsx",
  "app/api/account/entitlements/route.ts",
  "app/api/account/status/route.ts",
  "app/api/account/billing/route.ts",
  "app/api/account/subscriptions/route.ts",
  "app/api/account/subscriptions/[subscriptionId]/route.ts",
  "app/api/payments/ecpay/recurring/checkout/route.ts",
  "app/api/payments/ecpay/recurring/notify/route.ts",
  "app/api/daily/meeting-token/route.ts",
  "app/api/rooms/create/route.ts",
  "app/api/rooms/presence/event/route.ts",
  "app/api/rooms/[roomId]/presence-state/route.ts",
  "app/api/rooms/[roomId]/commercial-extension/route.ts",
  "supabase/migrations/20260720123000_p2_rooms_299_commercial_closure.sql",
  "supabase/validation/P2_SUPABASE_SCHEMA_ACCEPTANCE_CHECK.sql",
  "supabase/validation/P2_SUPABASE_RUNTIME_ACCEPTANCE_CHECK.sql",
  "supabase/validation/P1_SUPABASE_SCHEMA_ACCEPTANCE_NO_TEMP_RECOVERY.sql",
  "supabase/rollback/20260720123000_p2_rooms_299_commercial_closure_rollback.sql",
  "scripts/verify-production-release.mjs",
];
requiredFiles.forEach((rel) => check(`file:${rel}`, exists(rel), rel));

const contracts = [
  ["P2 package tag", "lib/p2Status.ts", "calmco-p2-rooms-299-commercial-v130-2026-07-20"],
  ["Rooms 299 scope", "lib/p2Status.ts", "rooms_299_controlled_commercial_pilot"],
  ["P3 Buddies blocked", "lib/p2Status.ts", "blocked_until_p3_settlement"],
  ["AI frozen", "lib/p2Status.ts", 'ai: "long_term_freeze"'],
  ["Public gate", "lib/productCatalog.ts", "NEXT_PUBLIC_PRICING_V2_ROOMS_299_ENABLED"],
  ["Rooms 299 active condition", "lib/productCatalog.ts", 'purchaseStatus: ROOMS_299_PUBLIC_PILOT_ENABLED ? "active" : "planned"'],
  ["Rooms 299 checkout code", "lib/productCatalog.ts", '"rooms_unlimited_299"'],
  ["Active plan list", "lib/productCatalog.ts", "ACTIVE_PURCHASABLE_PLANS"],
  ["Unknown plan no fallback", "lib/productCatalog.ts", "const plan = getProductPlan(code);"],
  ["Recurring button routing", "components/billing/PricingCheckoutButton.tsx", '"/api/payments/ecpay/recurring/checkout"'],
  ["Recurring disclosure", "components/billing/PricingCheckoutButton.tsx", "每月自動續扣"],
  ["Server gate", "app/api/payments/ecpay/recurring/checkout/route.ts", "isRooms299ServerPilotEnabled"],
  ["ECPAY gate", "app/api/payments/ecpay/recurring/checkout/route.ts", 'ECPAY_RECURRING_ENABLED'],
  ["Exact P2 plan", "app/api/payments/ecpay/recurring/checkout/route.ts", 'plan.code === "rooms_unlimited_299"'],
  ["Duplicate subscription guard", "app/api/payments/ecpay/recurring/checkout/route.ts", "SUBSCRIPTION_ALREADY_EXISTS"],
  ["P2 payment RPC", "app/api/payments/ecpay/recurring/notify/route.ts", "cowork_apply_subscription_payment_v2"],
  ["No hardcoded VIP notify", "app/api/payments/ecpay/recurring/notify/route.ts", "commercial_entitlement_applied"],
  ["Recurring amount check", "app/api/payments/ecpay/recurring/notify/route.ts", "AMOUNT_MISMATCH"],
  ["Paid callback invoice", "app/api/payments/ecpay/recurring/notify/route.ts", "insertInvoiceRequestIfMissing"],
  ["Paid callback ledger", "app/api/payments/ecpay/recurring/notify/route.ts", "insertLedgerIfMissing"],
  ["Commercial resolver", "lib/server/commercialEntitlements.ts", "getCommercialEntitlementSnapshot"],
  ["Visual wallet RPC", "lib/server/commercialEntitlements.ts", "cowork_consume_usage_wallet_v2"],
  ["Visual downgrade", "lib/server/commercialEntitlements.ts", "downgradeRequired"],
  ["Extension RPC", "lib/server/commercialEntitlements.ts", "cowork_finalize_room_extension_v2"],
  ["Legacy compatibility", "lib/server/commercialEntitlements.ts", "legacyVip"],
  ["Stable billing key", "lib/server/roomInfra.ts", ":start:"],
  ["Token follows scheduled end", "app/api/daily/meeting-token/route.ts", "scheduledEndSeconds"],
  ["Token no recharge note", "app/api/daily/meeting-token/route.ts", "stable across scheduled_end_at"],
  ["Commercial plan access session", "app/api/daily/meeting-token/route.ts", "commercial_plan_code"],
  ["Presence wallet debit", "app/api/rooms/presence/event/route.ts", "consumeVisualSeconds"],
  ["Presence survives wallet error", "app/api/rooms/presence/event/route.ts", "visual_wallet_unavailable"],
  ["Presence interval class", "lib/server/roomPresence.ts", "interval_media_class"],
  ["Commercial presence state", "app/api/rooms/[roomId]/presence-state/route.ts", "commercial_state"],
  ["Commercial extension route", "app/api/rooms/[roomId]/commercial-extension/route.ts", "finalizeCommercialRoomExtension"],
  ["Extension waiting maps 409", "app/api/rooms/[roomId]/commercial-extension/route.ts", "WAITING_FOR_PARTICIPANTS"],
  ["Controlled reload suppress leave", "components/rooms/RoomLifecycleBridge.tsx", "suppressLeaveRef"],
  ["Visual UI downgrade", "components/rooms/RoomLifecycleBridge.tsx", "visualQuotaExhausted"],
  ["Extension apply UI", "components/rooms/RoomLifecycleBridge.tsx", "finalizeExtension"],
  ["Room create optional gate", "app/api/rooms/create/route.ts", "isP2RoomCreationGateEnabled"],
  ["Room create entitlement", "app/api/rooms/create/route.ts", "requireRoomsCreationEntitlement"],
  ["Cancel at period end", "app/api/account/subscriptions/[subscriptionId]/route.ts", "cancel_at_period_end"],
  ["Entitlement preserved", "app/api/account/subscriptions/[subscriptionId]/route.ts", "entitlement_preserved_until"],
  ["Account wallet projection", "app/api/account/status/route.ts", "visual_wallet"],
  ["Billing wallet events", "app/api/account/billing/route.ts", "wallet_events"],
  ["Safe subscription projection", "app/api/account/subscriptions/route.ts", "commercial_entitlement_status"],
  ["Release P2 section", "lib/releaseInfo.ts", "p2:"],
  ["Release P3 block list", "lib/releaseInfo.ts", "p3_plans_blocked"],
  ["Production verifier P2", "scripts/verify-production-release.mjs", "P2 production verification"],
  ["Migration entitlement table", "supabase/migrations/20260720123000_p2_rooms_299_commercial_closure.sql", "create table if not exists public.user_plan_entitlements"],
  ["Migration wallet table", "supabase/migrations/20260720123000_p2_rooms_299_commercial_closure.sql", "create table if not exists public.user_usage_wallets"],
  ["Migration wallet event table", "supabase/migrations/20260720123000_p2_rooms_299_commercial_closure.sql", "create table if not exists public.user_usage_wallet_events"],
  ["Migration payment applications", "supabase/migrations/20260720123000_p2_rooms_299_commercial_closure.sql", "subscription_payment_applications"],
  ["Migration extension grants", "supabase/migrations/20260720123000_p2_rooms_299_commercial_closure.sql", "room_extension_grants"],
  ["Migration RLS", "supabase/migrations/20260720123000_p2_rooms_299_commercial_closure.sql", "enable row level security"],
  ["Migration browser revoke", "supabase/migrations/20260720123000_p2_rooms_299_commercial_closure.sql", "from public, anon, authenticated"],
  ["Migration service role", "supabase/migrations/20260720123000_p2_rooms_299_commercial_closure.sql", "to service_role"],
  ["Migration plan blocked", "supabase/migrations/20260720123000_p2_rooms_299_commercial_closure.sql", "P2_PLAN_BLOCKED_UNTIL_P3"],
  ["Migration one extension", "supabase/migrations/20260720123000_p2_rooms_299_commercial_closure.sql", "P2_EXTENSION_PILOT_LIMIT_REACHED"],
  ["Migration atomic payment", "supabase/migrations/20260720123000_p2_rooms_299_commercial_closure.sql", "cowork_apply_subscription_payment_v2"],
  ["Migration atomic extension", "supabase/migrations/20260720123000_p2_rooms_299_commercial_closure.sql", "cowork_finalize_room_extension_v2"],
  ["Migration refund reversal RPC", "supabase/migrations/20260720123000_p2_rooms_299_commercial_closure.sql", "cowork_reverse_subscription_payment_v2"],
  ["Migration refund trigger", "supabase/migrations/20260720123000_p2_rooms_299_commercial_closure.sql", "trg_p2_refund_reversal"],
  ["Full refund only auto reversal", "supabase/migrations/20260720123000_p2_rooms_299_commercial_closure.sql", "partial_refund_requires_manual_entitlement_decision"],
  ["Refund entitlement revoke", "supabase/migrations/20260720123000_p2_rooms_299_commercial_closure.sql", "entitlement_key = 'rooms_access'"],
  ["Refund wallet status", "supabase/migrations/20260720123000_p2_rooms_299_commercial_closure.sql", "status = 'refunded'"],
  ["Refund reversal reliability", "supabase/migrations/20260720123000_p2_rooms_299_commercial_closure.sql", "p2_refund_entitlement_reversal_failed"],
  ["Schema validation refund RPC", "supabase/validation/P2_SUPABASE_SCHEMA_ACCEPTANCE_CHECK.sql", "cowork_reverse_subscription_payment_v2"],
  ["Runtime refund acceptance", "supabase/validation/P2_SUPABASE_RUNTIME_ACCEPTANCE_CHECK.sql", "Full-refund reversal integrity"],
  ["Rollback refund trigger", "supabase/rollback/20260720123000_p2_rooms_299_commercial_closure_rollback.sql", "trg_p2_refund_reversal"],
  ["Validation no temp table", "supabase/validation/P2_SUPABASE_SCHEMA_ACCEPTANCE_CHECK.sql", "with checks as"],
  ["P1 recovery no temp table", "supabase/validation/P1_SUPABASE_SCHEMA_ACCEPTANCE_NO_TEMP_RECOVERY.sql", "P1_SUPABASE_SCHEMA_ACCEPTANCE"],
  ["P1 recovery explains error", "supabase/validation/P1_SUPABASE_SCHEMA_ACCEPTANCE_NO_TEMP_RECOVERY.sql", "p1_acceptance_results"],
];
contracts.forEach(([name, rel, needle]) => check(name, includes(rel, needle), `${rel} :: ${needle}`));

check(
  "Notify does not grant legacy vip",
  excludes("app/api/payments/ecpay/recurring/notify/route.ts", 'plan: "vip"'),
  "recurring notify must use P2 application RPC",
);
check(
  "P3 plans not enabled",
  ["buddies_pro_399", "whole_site_599", "host_999"].every((code) => {
    const source = read("lib/productCatalog.ts");
    const start = source.indexOf(`code: "${code}"`);
    const next = source.indexOf("\n  {", start + 10);
    const block = source.slice(start, next > start ? next : source.length);
    return block.includes('purchaseEnabled: false');
  }),
  "399/599/999 purchaseEnabled must remain false",
);

console.table(results);
const failed = results.filter((item) => item.status === "FAIL");
console.log(`P2 contract checks: ${results.length - failed.length}/${results.length} PASS`);
if (failed.length) process.exitCode = 1;
