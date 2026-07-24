import process from "node:process";

const base = String(
  process.env.PRODUCTION_URL ||
    process.env.SITE_URL ||
    "https://getcalmandco.com",
).replace(/\/$/, "");
const expectedSha = String(process.env.EXPECTED_GIT_SHA || "").trim();
const roomId = String(process.env.P4A_ROOM_ID || "").trim();
const accessToken = String(process.env.P4A_ACCESS_TOKEN || "").trim();

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
  "calmco-p4a-rooms-operational-ux-v140-2026-07-24"
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
  release.p4a?.build_tags?.operations !==
  "room-operational-snapshot-v140-2026-07-24"
) {
  throw new Error("P4-A release metadata is missing");
}

let roomOperations = null;
if (roomId || accessToken) {
  if (!roomId || !accessToken) {
    throw new Error("P4A_ROOM_ID and P4A_ACCESS_TOKEN must be supplied together");
  }
  roomOperations = await getJson(
    `/api/rooms/${encodeURIComponent(roomId)}/operations`,
    { Authorization: `Bearer ${accessToken}` },
  );
  if (roomOperations.build_tag !== "room-operational-snapshot-v140-2026-07-24") {
    throw new Error(`Unexpected room operations build tag: ${roomOperations.build_tag}`);
  }
  if (!roomOperations.server_now || !roomOperations.room?.scheduled_end_at) {
    throw new Error("Room operations response is missing authoritative clock fields");
  }
  if (!Array.isArray(roomOperations.members)) {
    throw new Error("Room operations response is missing member projection");
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      production_sha: expectedSha,
      release_build_tag: release.build_tag,
      p4a_operations_checked: Boolean(roomOperations),
      p4a_operations_build_tag: roomOperations?.build_tag || null,
    },
    null,
    2,
  ),
);
