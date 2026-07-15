#!/usr/bin/env node

const DEFAULT_PRODUCTION_URL = "https://getcalmandco.com";
const EXPECTED_RELEASE_TAG =
  "calmco-p0-0-production-alignment-v127-2026-07-15";

const productionUrl = new URL(
  process.env.PRODUCTION_URL || DEFAULT_PRODUCTION_URL,
);

const expectedGitSha = String(
  process.env.EXPECTED_GIT_SHA || "",
).trim();

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
  url.searchParams.set("__p00", `${Date.now()}-${Math.random()}`);
  return url;
}

async function fetchResponse(pathname) {
  const response = await fetch(withCacheBust(pathname), {
    redirect: "follow",
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "User-Agent": "CalmCo-P0-0-Release-Check/1.0",
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

async function readReleaseInfo() {
  const result = await fetchResponse("/api/release");

  if (!result.response.ok) {
    throw new Error(
      `/api/release returned ${result.response.status}: ${result.text.slice(0, 240)}`,
    );
  }

  let payload;

  try {
    payload = JSON.parse(result.text);
  } catch {
    throw new Error("/api/release did not return valid JSON.");
  }

  return { ...result, payload };
}

function shaMatches(actual, expected) {
  if (!expected) return actual && actual !== "unknown";
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
      const release = await readReleaseInfo();
      const sha = String(
        release.payload?.deployment?.git_commit_sha || "",
      );
      const branch = String(
        release.payload?.deployment?.branch || "",
      );

      if (
        shaMatches(sha, expectedGitSha) &&
        branch === "main"
      ) {
        return release;
      }

      lastError = new Error(
        `Production is not ready yet. branch=${branch || "missing"}, sha=${sha || "missing"}`,
      );
    } catch (error) {
      lastError = error;
    }

    if (Date.now() >= deadline) {
      throw lastError || new Error("Production release check timed out.");
    }

    console.log(
      `[P0-0] Waiting for production to expose main/${expectedGitSha || "a real SHA"}...`,
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
  const roomPolicy = product?.room_policy || {};
  const pricingPolicy = product?.pricing_policy || {};
  const aiPolicy = product?.ai_policy || {};

  record(
    "Release endpoint",
    payload?.ok === true,
    true,
    payload?.ok,
  );

  record(
    "Release tag",
    payload?.build_tag === EXPECTED_RELEASE_TAG,
    EXPECTED_RELEASE_TAG,
    payload?.build_tag,
  );

  record(
    "Source repository",
    payload?.source_of_truth?.repository ===
      "noplzy/cowork-web",
    "noplzy/cowork-web",
    payload?.source_of_truth?.repository,
  );

  record(
    "Production repository metadata",
    alignment?.repository_matches === true,
    true,
    alignment?.repository_matches,
  );

  record(
    "Production branch",
    deployment?.branch === "main",
    "main",
    deployment?.branch,
  );

  record(
    "Production environment",
    deployment?.environment === "production",
    "production",
    deployment?.environment,
  );

  record(
    "Git commit metadata",
    alignment?.git_metadata_available === true,
    true,
    alignment?.git_metadata_available,
  );

  record(
    "Expected main commit",
    shaMatches(
      String(deployment?.git_commit_sha || ""),
      expectedGitSha,
    ),
    expectedGitSha || "non-unknown SHA",
    deployment?.git_commit_sha,
  );

  record(
    "Room durations",
    JSON.stringify(roomPolicy?.generalDurations) ===
      JSON.stringify([25, 50, 75]),
    "[25,50,75]",
    JSON.stringify(roomPolicy?.generalDurations),
  );

  record(
    "Activity duration",
    roomPolicy?.activityDuration === 90,
    90,
    roomPolicy?.activityDuration,
  );

  record(
    "100-minute policy",
    Array.isArray(roomPolicy?.deprecatedDurations) &&
      roomPolicy.deprecatedDurations.includes(100),
    "deprecated",
    JSON.stringify(roomPolicy?.deprecatedDurations),
  );

  record(
    "Active paid plan",
    pricingPolicy?.active_paid_plan_code === "vip_month",
    "vip_month",
    pricingPolicy?.active_paid_plan_code,
  );

  record(
    "AI long-term freeze",
    aiPolicy?.status === "long_term_freeze",
    "long_term_freeze",
    aiPolicy?.status,
  );

  record(
    "AI excluded from pricing",
    aiPolicy?.includedInPricing === false,
    false,
    aiPolicy?.includedInPricing,
  );

  record(
    "Release response header",
    release.releaseHeader === deployment?.git_commit_sha,
    deployment?.git_commit_sha,
    release.releaseHeader,
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
    record(
      `${name} HTTP`,
      result.response.ok,
      "2xx",
      result.response.status,
    );

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
    "今天，不用一個人開始。",
    homeText.includes("今天，不用一個人開始。"),
  );

  record(
    "Rooms 25-minute option",
    roomsText.includes("25 分鐘"),
    true,
    roomsText.includes("25 分鐘"),
  );

  record(
    "Rooms 50-minute option",
    roomsText.includes("50 分鐘"),
    true,
    roomsText.includes("50 分鐘"),
  );

  record(
    "Rooms 75-minute option",
    roomsText.includes("75 分鐘"),
    true,
    roomsText.includes("75 分鐘"),
  );

  record(
    "Rooms no public 100-minute option",
    !roomsText.includes("100 分鐘"),
    "absent",
    roomsText.includes("100 分鐘") ? "present" : "absent",
  );

  record(
    "Pricing AI freeze message",
    pricingText.includes("AI 功能長期暫停"),
    "AI 功能長期暫停",
    pricingText.includes("AI 功能長期暫停"),
  );

  record(
    "Pricing active production fact",
    pricingText.includes("NT$199 / 30 天"),
    "NT$199 / 30 天",
    pricingText.includes("NT$199 / 30 天"),
  );

  const forbiddenPricingTerms = [
    "Host Credit",
    "Shared Host",
    "AI 主持",
    "個人 AI",
  ];

  const foundForbiddenTerms = forbiddenPricingTerms.filter((term) =>
    pricingText.includes(term),
  );

  record(
    "Pricing excludes AI benefits",
    foundForbiddenTerms.length === 0,
    "no AI benefit terms",
    foundForbiddenTerms.join(", ") || "none",
  );

  console.table(results);

  const failures = results.filter(
    (result) => result.status === "FAIL",
  );

  if (failures.length > 0) {
    console.error(
      `\n[P0-0] ${failures.length} production alignment check(s) failed.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `\n[P0-0] Production is aligned with main at ${deployment.git_commit_sha}.`,
  );
}

main().catch((error) => {
  console.error("[P0-0] Production verification failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
