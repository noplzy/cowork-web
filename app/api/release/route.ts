import { NextResponse } from "next/server";
import {
  RELEASE_BUILD_TAG,
  getPublicReleaseInfo,
} from "@/lib/releaseInfo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const payload = getPublicReleaseInfo();
  const response = NextResponse.json(payload);

  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, max-age=0, must-revalidate",
  );
  response.headers.set(
    "X-CalmCo-Release",
    payload.deployment.git_commit_sha,
  );
  response.headers.set("X-CalmCo-Release-Tag", RELEASE_BUILD_TAG);
  response.headers.set(
    "X-CalmCo-Branch",
    payload.deployment.branch,
  );

  return response;
}
