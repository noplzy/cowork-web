import { NextResponse } from "next/server";
import { requireBuddiesRealNameVerifiedForRequest } from "@/lib/server/identityAccess";
import { getBuddySettlementSnapshot } from "@/lib/server/buddySettlement";
import { P3_BUILD_TAGS } from "@/lib/p3Status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ bookingId: string }> };

export async function GET(req: Request, context: Context) {
  try {
    const { userId } = await requireBuddiesRealNameVerifiedForRequest(req);
    const { bookingId } = await context.params;
    const snapshot = await getBuddySettlementSnapshot(bookingId, userId);
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || "讀取 Buddies 結算失敗。",
        build_tag: P3_BUILD_TAGS.settlement,
      },
      { status: Number(error?.status || 500) },
    );
  }
}
