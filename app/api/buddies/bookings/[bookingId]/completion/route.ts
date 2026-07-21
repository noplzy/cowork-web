import { NextResponse } from "next/server";
import { requireBuddiesRealNameVerifiedForRequest } from "@/lib/server/identityAccess";
import {
  confirmBuddyCompletion,
  requireBuddiesCommercialPilot,
} from "@/lib/server/buddySettlement";
import { P3_BUILD_TAGS } from "@/lib/p3Status";

export const runtime = "nodejs";
type Context = { params: Promise<{ bookingId: string }> };

export async function POST(req: Request, context: Context) {
  try {
    const { userId } = await requireBuddiesRealNameVerifiedForRequest(req);
    requireBuddiesCommercialPilot(userId);
    const { bookingId } = await context.params;
    const result = await confirmBuddyCompletion(bookingId, userId);
    return NextResponse.json({
      completion: result,
      build_tag: P3_BUILD_TAGS.settlement,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || "確認完成失敗。",
        build_tag: P3_BUILD_TAGS.settlement,
      },
      { status: Number(error?.status || 500) },
    );
  }
}
