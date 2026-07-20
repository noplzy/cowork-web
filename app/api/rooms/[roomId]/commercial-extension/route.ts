import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { finalizeCommercialRoomExtension } from "@/lib/server/commercialEntitlements";
import { P2_BUILD_TAGS } from "@/lib/p2Status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ roomId: string }> };
type Body = { extensionWindowKey?: string; idempotencyKey?: string };

function statusFor(message: string) {
  if (message === "UNAUTHORIZED") return 401;
  if (/REQUIRES_ROOMS_ENTITLEMENT|POINTS_INSUFFICIENT/.test(message)) return 402;
  if (/SPONSOR_NOT_MEMBER/.test(message)) return 403;
  if (/ROOM_NOT_FOUND/.test(message)) return 404;
  if (/ROOM_ENDED/.test(message)) return 410;
  if (/WAITING_FOR_PARTICIPANTS|WINDOW_STALE|PILOT_LIMIT_REACHED|NO_CONTINUE_DECISIONS/.test(message)) return 409;
  if (/COMMERCIAL_DISABLED/.test(message)) return 503;
  return 400;
}

export async function POST(req: Request, context: Context) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { roomId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as Body;
    const extensionWindowKey = String(body.extensionWindowKey || "").trim();
    if (!extensionWindowKey.startsWith("end:")) {
      return NextResponse.json(
        { error: "缺少有效的延長視窗。", code: "INVALID_EXTENSION_WINDOW", build_tag: P2_BUILD_TAGS.extension },
        { status: 400 },
      );
    }
    const idempotencyKey = String(
      body.idempotencyKey || `room:${roomId}:window:${extensionWindowKey}:sponsor:${userId}`,
    ).slice(0, 500);
    const result = await finalizeCommercialRoomExtension({
      roomId,
      sponsorUserId: userId,
      extensionWindowKey,
      idempotencyKey,
    });
    return NextResponse.json(
      { extension: result, build_tag: P2_BUILD_TAGS.extension },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "延長同行空間失敗。";
    return NextResponse.json(
      { error: message, build_tag: P2_BUILD_TAGS.extension },
      { status: statusFor(message) },
    );
  }
}
