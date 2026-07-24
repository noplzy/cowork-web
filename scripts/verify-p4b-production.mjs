import process from "node:process";

const base = String(
  process.env.PRODUCTION_URL ||
    process.env.SITE_URL ||
    "https://getcalmandco.com",
).replace(/\/$/, "");
const expectedSha = String(process.env.EXPECTED_GIT_SHA || "").trim();
const accessToken = String(process.env.P4B_ACCESS_TOKEN || "").trim();

if (!expectedSha) throw new Error("EXPECTED_GIT_SHA is required");

async function getJson(path, headers = {}) {
  const response = await fetch(`${base}${path}`, {
    headers,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  return payload;
}

const release = await getJson("/api/release");
if (
  release.build_tag !==
  "calmco-p4b-buddies-operational-workspaces-v141-2026-07-24"
) {
  throw new Error(`Unexpected release build tag: ${release.build_tag}`);
}
if (release.deployment?.git_commit_sha !== expectedSha) {
  throw new Error(
    `Production SHA mismatch: expected ${expectedSha}, got ${release.deployment?.git_commit_sha}`,
  );
}
if (release.deployment?.branch !== "main") {
  throw new Error("Production branch is not main");
}
if (
  release.p4b?.build_tags?.workspace !==
  "buddies-operational-workspace-v141-2026-07-24"
) {
  throw new Error("P4-B release metadata is missing");
}

let workspace = null;
if (accessToken) {
  workspace = await getJson("/api/account/buddies/workspace", {
    Authorization: `Bearer ${accessToken}`,
  });
  if (
    workspace.build_tag !==
    "buddies-operational-workspace-v141-2026-07-24"
  ) {
    throw new Error(`Unexpected workspace build tag: ${workspace.build_tag}`);
  }
  if (!workspace.server_now || !workspace.buyer || !workspace.provider || !workspace.payout) {
    throw new Error("Workspace response is missing operational projections");
  }
  if (!Array.isArray(workspace.buyer.bookings)) {
    throw new Error("Buyer workspace bookings are missing");
  }
  if (!Array.isArray(workspace.provider.bookings)) {
    throw new Error("Provider workspace bookings are missing");
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      production_sha: expectedSha,
      release_build_tag: release.build_tag,
      p4b_workspace_checked: Boolean(workspace),
      p4b_workspace_build_tag: workspace?.build_tag || null,
    },
    null,
    2,
  ),
);
