import type { NextConfig } from "next";

function safeHeaderValue(value: string | undefined, fallback: string) {
  return (value || fallback)
    .replace(/[^\x20-\x7E]/g, "")
    .slice(0, 160);
}

const releaseSha = safeHeaderValue(
  process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA,
  "unknown",
);

const releaseBranch = safeHeaderValue(
  process.env.VERCEL_GIT_COMMIT_REF || process.env.GIT_BRANCH,
  "unknown",
);

const releaseEnvironment = safeHeaderValue(
  process.env.VERCEL_ENV || process.env.NODE_ENV,
  "development",
);

const releaseTag =
  "calmco-p0-0-production-alignment-v127-2026-07-15";

const releaseHeaders = [
  { key: "X-CalmCo-Release", value: releaseSha },
  { key: "X-CalmCo-Release-Tag", value: releaseTag },
  { key: "X-CalmCo-Branch", value: releaseBranch },
  { key: "X-CalmCo-Environment", value: releaseEnvironment },
];

const publicNoStoreHeaders = [
  ...releaseHeaders,
  {
    key: "Cache-Control",
    value: "no-store, no-cache, max-age=0, must-revalidate",
  },
];

const noStorePaths = [
  "/",
  "/rooms",
  "/pricing",
  "/buddies",
  "/contact",
  "/refund-policy",
  "/privacy",
  "/terms",
  "/service-delivery",
  "/api/release",
  "/api/product/catalog",
];

const nextConfig: NextConfig = {
  async headers() {
    return noStorePaths.map((source) => ({
      source,
      headers: publicNoStoreHeaders,
    }));
  },
};

export default nextConfig;
