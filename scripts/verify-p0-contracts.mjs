#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [];

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function check(name, ok, detail = "") {
  checks.push({ check: name, status: ok ? "PASS" : "FAIL", detail });
}

const catalog = read("lib/productCatalog.ts");
const pricing = read("app/pricing/page.tsx");
const migration = read(
  "supabase/migrations/20260718193000_p0_presence_summary_pricing_v2.sql",
);
const presence = read("lib/server/roomPresence.ts");
const summary = read("lib/server/roomSummary.ts");
const recurring = read("app/api/payments/ecpay/recurring/checkout/route.ts");
const release = read("lib/releaseInfo.ts");
const bridge = read("components/rooms/RoomLifecycleBridge.tsx");
const meetingToken = read("app/api/daily/meeting-token/route.ts");
const roomInfra = read("lib/server/roomInfra.ts");
const adminSummary = read("app/api/admin/rooms/[roomId]/summary/route.ts");
const leaveRoute = read("app/api/rooms/leave/route.ts");
const cleanupRoute = read("app/api/internal/rooms/cleanup/route.ts");

for (const marker of [
  "rooms_unlimited_299",
  "buddies_pro_399",
  "whole_site_599",
  "host_999",
]) {
  check(`Catalog contains ${marker}`, catalog.includes(marker));
}

for (const marker of ["amountTwd: 299", "amountTwd: 399", "amountTwd: 599", "amountTwd: 999"]) {
  check(`Catalog price ${marker}`, catalog.includes(marker));
}

check("Pilot remains active", catalog.includes('code: "vip_month"') && catalog.includes('purchaseStatus: "active"'));
check("Pricing v2 commercial false", catalog.includes('commercialLaunchEnabled: false'));
check("AI long-term freeze", catalog.includes('status: "long_term_freeze"'));
check("No AI add-on", !catalog.includes("host_credit_") && !catalog.includes("sharedHostIncluded"));
check("Pricing page final plan markers", ["Rooms 無限同行", "Buddies 專業", "全站同行", "主理人"].every((item) => `${catalog}\n${pricing}`.includes(item)));
check("Pricing page blocks next-spec", pricing.includes("最終規格・尚未開放"));

for (const table of [
  "room_member_presence_state",
  "room_extension_confirmations",
  "room_session_summaries",
  "room_participant_summaries",
]) {
  check(`Migration creates ${table}`, migration.includes(`create table if not exists public.${table}`));
}
check("RLS enabled", (migration.match(/enable row level security/g) || []).length >= 4);
check("Service role RPC protected", migration.includes("grant execute on function public.cowork_apply_presence_usage") && migration.includes("to service_role"));
check("Presence current-state upsert", presence.includes('from("room_member_presence_state")') && presence.includes('onConflict: "room_id,user_id"'));
check("Presence binds access session", presence.includes("resolveAccessSession") && presence.includes("cowork_apply_presence_usage"));
check("BRB reliability signal", presence.includes("brb_expired_without_return"));
check("Extension confirmation is non-commercial", presence.includes("writeExtensionConfirmation") && presence.includes("sponsor_points_required"));
check("Summary idempotent upsert", summary.includes('from("room_session_summaries")') && summary.includes('onConflict: "room_id"'));
check("Participant summary idempotent", summary.includes('from("room_participant_summaries")') && summary.includes('onConflict: "room_id,user_id"'));
check("No transcript storage columns", !migration.match(/\b(transcript|raw_audio|raw_video)\s+(text|jsonb|bytea)/i));
check("Recurring requires commercial gate", recurring.includes("PRICING_V2_COMMERCIAL_ENABLED") && recurring.includes("ECPAY_RECURRING_PLAN_ALLOWLIST"));
check("Release exposes P0", release.includes("implementation_status") && release.includes("required_tables"));
check("Meeting token starts camera off", meetingToken.includes("start_video_off: true"));
check("Meeting token starts microphone off", meetingToken.includes("start_audio_off: true"));
check("90-minute credit cost is four", roomInfra.includes("durationMinutes >= 90) return 4"));
check("Mode change does not recreate leave effect", bridge.includes("}, [roomId]);") && !bridge.includes("}, [roomId, mode]);\n\n  async function callPresenceAction"));
check("Bridge calls authoritative leave route", bridge.includes('authedFetch("/api/rooms/leave"'));
check("BRB state survives heartbeat", presence.includes('previous?.presence_status === "brb"'));
check("Reliability events are idempotent", presence.includes("ensureReliabilityEvent"));
check("Usage RPC separates interval and current media", migration.includes("p_interval_media_class") && migration.includes("p_current_media_class"));
check("Provider cost uses sticky session class", summary.includes("price the whole connected session at the video rate"));
check("Missing extension confirmation is observable", summary.includes("extension_confirmation_missing"));
check("Admin room summary endpoint exists", adminSummary.includes("admin_room_summary_viewed"));
check("Normal leave creates summary", leaveRoute.includes("summarizeRoom(roomId)"));
check("Cleanup creates summaries", cleanupRoute.includes("post_session_summaries") && cleanupRoute.includes("summarizeRoom(roomId)"));

console.table(checks);
const failures = checks.filter((item) => item.status === "FAIL");
if (failures.length) {
  console.error(`\n[P0 contracts] ${failures.length} check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`\n[P0 contracts] ${checks.length} checks passed.`);
}
