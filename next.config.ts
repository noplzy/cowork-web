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
const releaseTag = "calmco-p1-trust-operations-v129-2026-07-18";

const releaseHeaders = [
  { key: "X-CalmCo-Release", value: releaseSha },
  { key: "X-CalmCo-Release-Tag", value: releaseTag },
  { key: "X-CalmCo-Branch", value: releaseBranch },
  { key: "X-CalmCo-Environment", value: releaseEnvironment },
];

const noStoreHeaders = [
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
  "/account/rooms/:path*",
  "/account/appeals/:path*",
  "/admin/appeals/:path*",
  "/api/release",
  "/api/product/catalog",
  "/api/rooms/:path*",
  "/api/account/rooms/:path*",
  "/api/account/moderation/:path*",
  "/api/appeals/:path*",
  "/api/admin/appeals/:path*",
  "/api/internal/rooms/summarize-ended",
];

const nextConfig: NextConfig = {
  async headers() {
    return noStorePaths.map((source) => ({ source, headers: noStoreHeaders }));
  },
};

export default nextConfig;
