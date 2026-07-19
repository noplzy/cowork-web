#!/usr/bin/env node

const DEFAULT_PRODUCTION_URL = "https://getcalmandco.com";
const EXPECTED_RELEASE_TAG = "calmco-p1-trust-operations-v129-2026-07-18";
const EXPECTED_PRICING_CODES = [
  "free",
  "rooms_unlimited_299",
  "buddies_pro_399",
  "whole_site_599",
  "host_999",
];

const productionUrl = new URL(
  process.env.PRODUCTION_URL || DEFAULT_PRODUCTION_URL,
);
const expectedGitSha = String(process.env.EXPECTED_GIT_SHA || "").trim();
const releaseWaitSeconds = Math.max(
  0,
  Number(process.env.RELEASE_WAIT_SECONDS || 0),
);
const releasePollSeconds = Math.max(
  5,
  Number(process.env.RELEASE_POLL_SECONDS || 15),
);
const results = [];

function record(name, ok, expected, actual) {
  results.push({
    check: name,
    status: ok ? "PASS" : "FAIL",
    expected: String(expected),
    actual: String(actual),
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withCacheBust(pathname) {
  const url = new URL(pathname, productionUrl);
  url.searchParams.set("__p1v129", `${Date.now()}-${Math.random()}`);
  return url;
}

async function fetchResponse(pathname) {
  const response = await fetch(withCacheBust(pathname), {
    redirect: "follow",
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "User-Agent": "CalmCo-P1-v129-Release-Check/1.0",
    },
  });
  const text = await response.text();
  return {
    response,
    text,
    releaseHeader: response.headers.get("x-calmco-release"),
    branchHeader: response.headers.get("x-calmco-branch"),
  };
}

async function readJson(pathname) {
  const result = await fetchResponse(pathname);
  if (!result.response.ok) {
    throw new Error(
      `${pathname} returned ${result.response.status}: ${result.text.slice(0, 240)}`,
    );
  }
  return { ...result, payload: JSON.parse(result.text) };
}

function shaMatches(actual, expected) {
  if (!expected) return Boolean(actual && actual !== "unknown");
  return (
    actual === expected ||
    actual.startsWith(expected) ||
    expected.startsWith(actual)
  );
}

async function waitForExpectedRelease() {
  const deadline = Date.now() + releaseWaitSeconds * 1000;
  let lastError = null;

  while (true) {
    try {
      const release = await readJson("/api/release");
      const sha = String(release.payload?.deployment?.git_commit_sha || "");
      const branch = String(release.payload?.deployment?.branch || "");
      if (shaMatches(sha, expectedGitSha) && branch === "main") return release;
      lastError = new Error(
        `Production not ready. branch=${branch || "missing"}, sha=${sha || "missing"}`,
      );
    } catch (error) {
      lastError = error;
    }

    if (Date.now() >= deadline) {
      throw lastError || new Error("Production release check timed out.");
    }
    console.log(
      `[P1-v129] Waiting for main/${expectedGitSha || "a real SHA"}...`,
    );
    await sleep(releasePollSeconds * 1000);
  }
}

function visibleText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const release = await waitForExpectedRelease();
  const payload = release.payload;
  const deployment = payload?.deployment || {};
  const alignment = payload?.alignment || {};
  const product = payload?.product || {};
  const p0 = payload?.p0 || {};
  const pricingPolicy = product?.pricing_policy || {};
  const p1 = payload?.p1 || {};
  const aiPolicy = product?.ai_policy || {};
  const roomPolicy = product?.room_policy || {};

  record("Release endpoint", payload?.ok === true, true, payload?.ok);
  record(
    "Release tag",
    payload?.build_tag === EXPECTED_RELEASE_TAG,
    EXPECTED_RELEASE_TAG,
    payload?.build_tag,
  );
  record(
    "Source repository",
    payload?.source_of_truth?.repository === "noplzy/cowork-web",
    "noplzy/cowork-web",
    payload?.source_of_truth?.repository,
  );
  record(
    "Repository metadata",
    alignment?.repository_matches === true,
    true,
    alignment?.repository_matches,
  );
  record("Production branch", deployment?.branch === "main", "main", deployment?.branch);
  record(
    "Production environment",
    deployment?.environment === "production",
    "production",
    deployment?.environment,
  );
  record(
    "Expected main commit",
    shaMatches(String(deployment?.git_commit_sha || ""), expectedGitSha),
    expectedGitSha || "non-unknown SHA",
    deployment?.git_commit_sha,
  );
  record(
    "Release response header",
    release.releaseHeader === deployment?.git_commit_sha,
    deployment?.git_commit_sha,
    release.releaseHeader,
  );

  record(
    "Room durations",
    JSON.stringify(roomPolicy?.generalDurations) === JSON.stringify([25, 50, 75]),
    "[25,50,75]",
    JSON.stringify(roomPolicy?.generalDurations),
  );
  record("Activity duration", roomPolicy?.activityDuration === 90, 90, roomPolicy?.activityDuration);
  record("Extension duration", roomPolicy?.extensionMinutes === 25, 25, roomPolicy?.extensionMinutes);
  record(
    "100-minute deprecated",
    Array.isArray(roomPolicy?.deprecatedDurations) &&
      roomPolicy.deprecatedDurations.includes(100),
    true,
    JSON.stringify(roomPolicy?.deprecatedDurations),
  );

  record(
    "Active paid plan remains pilot",
    pricingPolicy?.active_paid_plan_code === "vip_month",
    "vip_month",
    pricingPolicy?.active_paid_plan_code,
  );
  record(
    "Pricing v2 not purchasable",
    pricingPolicy?.pricing_v2_status === "final_spec_not_purchasable" &&
      pricingPolicy?.pricing_v2_commercial_launch_enabled === false,
    "final_spec_not_purchasable / false",
    `${pricingPolicy?.pricing_v2_status} / ${pricingPolicy?.pricing_v2_commercial_launch_enabled}`,
  );
  const actualCodes = pricingPolicy?.pricing_v2_plan_codes || [];
  record(
    "Pricing v2 final codes",
    EXPECTED_PRICING_CODES.every((code) => actualCodes.includes(code)),
    EXPECTED_PRICING_CODES.join(","),
    actualCodes.join(","),
  );
  record(
    "AI long-term freeze",
    aiPolicy?.status === "long_term_freeze" &&
      aiPolicy?.includedInPricing === false,
    "long_term_freeze / excluded",
    `${aiPolicy?.status} / ${aiPolicy?.includedInPricing}`,
  );

  record(
    "P1 permission build tag",
    p1?.build_tags?.permissions ===
      "admin-rbac-permission-closure-v129-2026-07-18",
    "admin-rbac-permission-closure-v129-2026-07-18",
    p1?.build_tags?.permissions,
  );
  record(
    "P1 appeals build tag",
    p1?.build_tags?.appeals === "appeals-lifecycle-v129-2026-07-18",
    "appeals-lifecycle-v129-2026-07-18",
    p1?.build_tags?.appeals,
  );
  record(
    "P1 required permissions",
    ["support.manage", "safety.manage", "appeals.manage"].every((permission) =>
      (p1?.required_admin_permissions || []).includes(permission),
    ),
    "support.manage,safety.manage,appeals.manage",
    (p1?.required_admin_permissions || []).join(","),
  );

  record(
    "P0 presence build tag",
    p0?.build_tags?.presence ===
      "room-presence-state-closure-v128-2026-07-18",
    "room-presence-state-closure-v128-2026-07-18",
    p0?.build_tags?.presence,
  );
  record(
    "P0 summary build tag",
    p0?.build_tags?.summary ===
      "room-post-session-summary-v128-2026-07-18",
    "room-post-session-summary-v128-2026-07-18",
    p0?.build_tags?.summary,
  );

  const [home, rooms, pricing] = await Promise.all([
    fetchResponse("/"),
    fetchResponse("/rooms"),
    fetchResponse("/pricing"),
  ]);
  const homeText = visibleText(home.text);
  const roomsText = visibleText(rooms.text);
  const pricingText = visibleText(pricing.text);

  for (const [name, result] of [
    ["Homepage", home],
    ["Rooms", rooms],
    ["Pricing", pricing],
  ]) {
    record(`${name} HTTP`, result.response.ok, "2xx", result.response.status);
    record(
      `${name} release header`,
      result.releaseHeader === deployment?.git_commit_sha,
      deployment?.git_commit_sha,
      result.releaseHeader,
    );
    record(
      `${name} branch header`,
      result.branchHeader === "main",
      "main",
      result.branchHeader,
    );
  }

  record(
    "Homepage source marker",
    homeText.includes("今天，不用一個人開始。"),
    true,
    homeText.includes("今天，不用一個人開始。"),
  );
  for (const duration of [25, 50, 75]) {
    record(
      `Rooms ${duration}-minute option`,
      roomsText.includes(`${duration} 分鐘`),
      true,
      roomsText.includes(`${duration} 分鐘`),
    );
  }
  record(
    "Rooms no public 100-minute option",
    !roomsText.includes("100 分鐘"),
    "absent",
    roomsText.includes("100 分鐘") ? "present" : "absent",
  );

  for (const marker of [
    "NT$199 / 30 天",
    "NT$299 / 月",
    "NT$399 / 月",
    "NT$599 / 月",
    "NT$999 / 月",
    "Rooms 無限同行",
    "Buddies 專業",
    "全站同行",
    "主理人",
    "最終規格・尚未開放",
    "AI 功能維持長期凍結",
  ]) {
    record(
      `Pricing marker: ${marker}`,
      pricingText.includes(marker),
      true,
      pricingText.includes(marker),
    );
  }
  record(
    "Pricing does not promise unlimited visual",
    !pricingText.includes("鏡頭無限") && !pricingText.includes("視訊無限"),
    "no unlimited visual promise",
    pricingText.includes("鏡頭無限") || pricingText.includes("視訊無限"),
  );

  console.table(results);
  const failures = results.filter((result) => result.status === "FAIL");
  if (failures.length > 0) {
    console.error(`\n[P1-v129] ${failures.length} check(s) failed.`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `\n[P1-v129] Production is aligned at ${deployment.git_commit_sha}.`,
  );
}

main().catch((error) => {
  console.error("[P1-v129] Production verification failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
