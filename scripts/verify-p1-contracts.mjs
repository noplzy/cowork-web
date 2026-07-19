#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const results = [];
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }
function exists(rel) { return fs.existsSync(path.join(root, rel)); }
function check(name, ok, actual = "") { results.push({ check: name, status: ok ? "PASS" : "FAIL", actual }); }

const requiredFiles = [
  "lib/server/trustOps.ts",
  "lib/server/appeals.ts",
  "lib/p1Status.ts",
  "app/api/account/moderation/actions/route.ts",
  "app/api/support/tickets/[ticketId]/route.ts",
  "app/api/support/tickets/[ticketId]/messages/route.ts",
  "app/api/appeals/route.ts",
  "app/api/appeals/[appealId]/route.ts",
  "app/api/appeals/[appealId]/messages/route.ts",
  "app/api/admin/appeals/route.ts",
  "app/api/admin/appeals/[appealId]/route.ts",
  "app/account/appeals/page.tsx",
  "app/account/appeals/[appealId]/page.tsx",
  "app/admin/appeals/page.tsx",
  "app/admin/appeals/[appealId]/page.tsx",
  "supabase/migrations/20260718223000_p1_trust_operations_appeals.sql",
];
for (const file of requiredFiles) check(`file:${file}`, exists(file), exists(file) ? "exists" : "missing");

const permissionRoutes = new Map([
  ["app/api/admin/support/tickets/route.ts", "support.manage"],
  ["app/api/admin/support/tickets/[ticketId]/route.ts", "support.manage"],
  ["app/api/admin/safety/reports/route.ts", "safety.manage"],
  ["app/api/admin/safety/reports/[reportId]/route.ts", "safety.manage"],
  ["app/api/admin/moderation/cases/route.ts", "safety.manage"],
  ["app/api/admin/moderation/cases/[caseId]/route.ts", "safety.manage"],
  ["app/api/admin/appeals/route.ts", "appeals.manage"],
  ["app/api/admin/appeals/[appealId]/route.ts", "appeals.manage"],
]);
for (const [file, permission] of permissionRoutes) {
  const source = read(file);
  check(`${file}:${permission}`, source.includes(`permission: "${permission}"`), source.match(/permission:\s*"[^"]+"/)?.[0] || "missing");
  check(`${file}:no-generic-admin`, !source.includes("getAdminUserFromRequest(req);"), source.includes("getAdminUserFromRequest(req);") ? "generic" : "specific");
}

const migration = read("supabase/migrations/20260718223000_p1_trust_operations_appeals.sql");
for (const marker of [
  "create table if not exists public.appeal_messages",
  "create table if not exists public.appeal_events",
  "alter table public.appeal_messages enable row level security",
  "alter table public.appeal_events enable row level security",
  "revoke all on table public.appeals from public, anon, authenticated",
  "revoke all on table public.support_tickets from public, anon, authenticated",
  "revoke all on table public.user_reports from public, anon, authenticated",
  "revoke all on table public.moderation_actions from public, anon, authenticated",
  "revoke all on table public.appeal_messages from public, anon, authenticated",
  "revoke all on table public.appeal_events from public, anon, authenticated",
  "cowork_create_appeal",
  "cowork_append_appeal_message",
  "cowork_close_appeal",
  "cowork_transition_appeal",
  "invalid appeal status transition from % to %",
  "v_restore_id := v_appeal.resolution_action_id",
  "moderation_actions_one_restore_per_appeal",
  "appeal_legacy_imported",
  "legacy_appeal_backfill",
  "appeal_closed_by_user',v_from,'closed",
  "revoke all on function public.cowork_create_appeal",
  "grant execute on function public.cowork_create_appeal",
]) check(`migration:${marker}`, migration.toLowerCase().includes(marker.toLowerCase()), marker);


const userSupportDetail = read("app/api/support/tickets/[ticketId]/route.ts");
check("privacy:user support ticket hides admin_note", !userSupportDetail.includes('.select("*")'), userSupportDetail.includes('.select("*")') ? "unsafe wildcard" : "safe projection");
check("privacy:user support messages hide actor UUID/metadata", userSupportDetail.includes('select("id,ticket_id,sender_role,body,created_at")'), "safe message projection");
check("privacy:user support events hide actor UUID/metadata", userSupportDetail.includes('select("id,ticket_id,actor_role,event_type,from_status,to_status,created_at")'), "safe event projection");

const moderationActions = read("app/api/account/moderation/actions/route.ts");
check(
  "account moderation excludes restore/note correctly",
  moderationActions.includes('.not("action_type", "in", "(restore,note)")'),
  moderationActions.split("\n").find((line) => line.includes(".not("))?.trim() || "missing",
);


const appealsHelper = read("lib/server/appeals.ts");
const userListProjection = appealsHelper.match(/export async function listUserAppeals[\s\S]*?export async function getUserAppeal/)?.[0] || "";
const userDetailProjection = appealsHelper.match(/export async function getUserAppeal[\s\S]*?export async function createAppeal/)?.[0] || "";
check("privacy:user appeal list hides decision_reason", !userListProjection.includes("decision_reason"), userListProjection.includes("decision_reason") ? "leaked" : "hidden");
check("privacy:user appeal detail hides decision_reason", !userDetailProjection.includes("decision_reason"), userDetailProjection.includes("decision_reason") ? "leaked" : "hidden");
check("privacy:user appeal events hide metadata", userDetailProjection.includes('select("id,appeal_id,actor_role,event_type,from_status,to_status,created_at")'), "safe event projection");
check("privacy:user appeal messages hide actor UUID/metadata", userDetailProjection.includes('select("id,appeal_id,sender_role,body,created_at")'), "safe message projection");

const adminAuth = read("lib/server/adminAuth.ts");
check("permission:appeals.manage", adminAuth.includes('"appeals.manage"'), "appeals.manage");
const shell = read("components/formalOps/FormalOpsShell.tsx");
check("nav:account appeals", shell.includes('["/account/appeals", "申訴紀錄"]'), "/account/appeals");
check("nav:admin appeals", shell.includes('["/admin/appeals", "申訴審查"]'), "/admin/appeals");

const release = read("lib/releaseInfo.ts");
check("release:p1 metadata", release.includes("required_admin_permissions"), "required_admin_permissions");
const catalog = read("lib/productCatalog.ts");
check("pricing:v2 remains disabled", catalog.includes('commercialLaunchEnabled: false'), "commercialLaunchEnabled: false");
check("ai:freeze remains", catalog.includes('status: "long_term_freeze"'), 'status: "long_term_freeze"');

console.table(results);
const failed = results.filter((item) => item.status === "FAIL");
if (failed.length) {
  console.error(`\n[P1-v129] ${failed.length} contract check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`\n[P1-v129] ${results.length} contract checks passed.`);
}
