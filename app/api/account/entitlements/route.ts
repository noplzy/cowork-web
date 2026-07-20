import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { getCommercialEntitlementSnapshot } from "@/lib/server/commercialEntitlements";
import { P2_BUILD_TAGS } from "@/lib/p2Status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const snapshot = await getCommercialEntitlementSnapshot(userId);
    return NextResponse.json(
      { entitlement: snapshot, build_tag: P2_BUILD_TAGS.entitlement },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "讀取權益失敗。";
    return NextResponse.json(
      { error: message, build_tag: P2_BUILD_TAGS.entitlement },
      { status: message === "UNAUTHORIZED" ? 401 : 500 },
    );
  }
}
