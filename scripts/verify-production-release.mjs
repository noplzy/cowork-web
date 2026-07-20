#!/usr/bin/env node

const productionUrl = new URL(
  process.env.PRODUCTION_URL || "https://getcalmandco.com",
);
const expectedGitSha = String(process.env.EXPECTED_GIT_SHA || "").trim();
const expectRooms299 = ["1", "true", "yes", "enabled"].includes(
  String(process.env.EXPECT_ROOMS_299_ENABLED || "").toLowerCase(),
);
const EXPECTED_RELEASE_TAG =
  "calmco-p2-rooms-299-commercial-v130-2026-07-20";
const results = [];

function record(check, ok, expected, actual) {
  results.push({ check, status: ok ? "PASS" : "FAIL", expected, actual });
}

async function request(path, init = {}) {
  const url = new URL(path, productionUrl);
  url.searchParams.set("__p2v130", `${Date.now()}-${Math.random()}`);
  const response = await fetch(url, {
    redirect: "follow",
    ...init,
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "User-Agent": "CalmCo-P2-v130-Release-Check/1.0",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  return {
    response,
    text,
    json: (() => {
      try { return JSON.parse(text); } catch { return null; }
    })(),
    releaseHeader: response.headers.get("x-calmco-release"),
    branchHeader: response.headers.get("x-calmco-branch"),
  };
}

function shaMatches(actual, expected) {
  if (!expected) return Boolean(actual && actual !== "unknown");
  return actual === expected || actual.startsWith(expected) || expected.startsWith(actual);
}

function visibleText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const release = await request("/api/release");
  if (!release.response.ok || !release.json) {
    throw new Error(`/api/release returned ${release.response.status}: ${release.text.slice(0, 300)}`);
  }

  const payload = release.json;
  const deployment = payload.deployment || {};
  const pricingPolicy = payload.product?.pricing_policy || {};
  const p2 = payload.p2 || {};

  record("Release endpoint", payload.ok === true, true, payload.ok);
  record("Release tag", payload.build_tag === EXPECTED_RELEASE_TAG, EXPECTED_RELEASE_TAG, payload.build_tag);
  record("Repository", payload.source_of_truth?.repository === "noplzy/cowork-web", "noplzy/cowork-web", payload.source_of_truth?.repository);
  record("Production branch", deployment.branch === "main", "main", deployment.branch);
  record("Production environment", deployment.environment === "production", "production", deployment.environment);
  record("Expected commit", shaMatches(String(deployment.git_commit_sha || ""), expectedGitSha), expectedGitSha || "real SHA", deployment.git_commit_sha);
  record("Release header", release.releaseHeader === deployment.git_commit_sha, deployment.git_commit_sha, release.releaseHeader);
  record("P2 package tag", p2.build_tags?.package === EXPECTED_RELEASE_TAG, EXPECTED_RELEASE_TAG, p2.build_tags?.package);
  record("P2 launch scope", p2.launch_scope === "rooms_unlimited_299_only", "rooms_unlimited_299_only", p2.launch_scope);
  record("P3 plans blocked", ["buddies_pro_399", "whole_site_599", "host_999"].every((code) => p2.p3_plans_blocked?.includes(code)), "399/599/999 blocked", JSON.stringify(p2.p3_plans_blocked));

  if (expectRooms299) {
    record("Rooms 299 public pilot", pricingPolicy.pricing_v2_status === "rooms_299_controlled_pilot" && pricingPolicy.pricing_v2_commercial_launch_enabled === true, "rooms_299_controlled_pilot / true", `${pricingPolicy.pricing_v2_status} / ${pricingPolicy.pricing_v2_commercial_launch_enabled}`);
  } else {
    record("Rooms 299 remains gated", pricingPolicy.pricing_v2_commercial_launch_enabled === false, false, pricingPolicy.pricing_v2_commercial_launch_enabled);
  }

  const [pricing, entitlementRoute, extensionRoute] = await Promise.all([
    request("/pricing"),
    request("/api/account/entitlements"),
    request("/api/rooms/00000000-0000-0000-0000-000000000000/commercial-extension", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
  ]);
  const pricingText = visibleText(pricing.text);
  record("Pricing HTTP", pricing.response.ok, "2xx", pricing.response.status);
  record("Pricing release header", pricing.releaseHeader === deployment.git_commit_sha, deployment.git_commit_sha, pricing.releaseHeader);
  record("Pricing P2 copy", pricingText.includes("Rooms 299") && pricingText.includes("P3"), "Rooms 299 + P3 boundary", pricingText.slice(0, 240));
  record("Entitlement route exists", entitlementRoute.response.status === 401, 401, entitlementRoute.response.status);
  record("Commercial extension route exists", extensionRoute.response.status === 401, 401, extensionRoute.response.status);

  console.table(results);
  const failed = results.filter((item) => item.status === "FAIL");
  if (failed.length) {
    console.error(`P2 production verification failed: ${failed.length} check(s).`);
    process.exitCode = 1;
  } else {
    console.log(`P2 production verification PASS (${results.length}/${results.length}).`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
