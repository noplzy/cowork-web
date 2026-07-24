import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { getRoomOperationalSnapshot } from "@/lib/server/roomOperationalSnapshot";
import { P4A_BUILD_TAGS } from "@/lib/p4aStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ roomId: string }> };

export async function GET(req: Request, context: Context) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { roomId } = await context.params;
    const snapshot = await getRoomOperationalSnapshot(roomId, userId);
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: any) {
    const message = error?.message || "讀取房內資訊失敗。";
    const status =
      error?.status ||
      (message === "UNAUTHORIZED"
        ? 401
        : message === "ROOM_NOT_FOUND"
          ? 404
          : message === "NOT_A_MEMBER"
            ? 403
            : 500);
    return NextResponse.json(
      { error: message, build_tag: P4A_BUILD_TAGS.operations },
      { status },
    );
  }
}
