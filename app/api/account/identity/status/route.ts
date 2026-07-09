import { NextResponse } from "next/server";
import { getIdentityStateFromRequest, identityAccessErrorResponse, IDENTITY_ACCESS_BUILD_TAG } from "@/lib/server/identityAccess";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { identity } = await getIdentityStateFromRequest(req);
    return NextResponse.json({ identity, build_tag: IDENTITY_ACCESS_BUILD_TAG });
  } catch (error: any) {
    const mapped = identityAccessErrorResponse(error, IDENTITY_ACCESS_BUILD_TAG);
    if (mapped) return mapped;
    return NextResponse.json({ error: error?.message || "讀取身份狀態失敗。", build_tag: IDENTITY_ACCESS_BUILD_TAG }, { status: 500 });
  }
}
