import process from "node:process";

const base = String(process.env.PRODUCTION_URL || process.env.SITE_URL || "https://getcalmandco.com").replace(/\/$/, "");
const expectedSha = String(process.env.EXPECTED_GIT_SHA || "").trim();
const secret = String(process.env.CRON_SECRET || process.env.ROOM_CLEANUP_SECRET || "").trim();
if (!expectedSha) throw new Error("EXPECTED_GIT_SHA is required");
if (!secret) throw new Error("CRON_SECRET or ROOM_CLEANUP_SECRET is required");

async function getJson(path, headers = {}) {
  const response = await fetch(`${base}${path}`, { headers, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${JSON.stringify(payload)}`);
  return payload;
}

const release = await getJson("/api/release");
if (release.build_tag !== "calmco-p3-buddies-settlement-trial-v131-2026-07-21") {
  throw new Error(`Unexpected release build tag: ${release.build_tag}`);
}
if (release.deployment?.git_commit_sha !== expectedSha) {
  throw new Error(`Production SHA mismatch: expected ${expectedSha}, got ${release.deployment?.git_commit_sha}`);
}
if (release.deployment?.branch !== "main") throw new Error("Production branch is not main");
if (release.p3?.safety_boundaries?.legal_escrow_claimed !== false) throw new Error("Escrow safety boundary mismatch");
if (release.p3?.safety_boundaries?.raw_bank_account_in_application_db !== false) throw new Error("Raw bank account safety boundary mismatch");
if (release.p3?.safety_boundaries?.ai_enabled !== false) throw new Error("AI must remain frozen for trial");

const readiness = await getJson("/api/internal/launch/readiness", {
  "x-cron-secret": secret,
});
if (readiness.build_tag !== "invite-trial-launch-gate-v131-2026-07-21") {
  throw new Error(`Unexpected readiness build tag: ${readiness.build_tag}`);
}
if (readiness.ready_for_invite_trial !== true) {
  throw new Error(`Invite trial is not ready: ${JSON.stringify(readiness.checks)}`);
}
console.log(JSON.stringify({ ok: true, production_sha: expectedSha, release_build_tag: release.build_tag, readiness_build_tag: readiness.build_tag }, null, 2));
