import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import {
  ROOM_PRESENCE_BUILD_TAG,
  getRoomPresenceState,
} from "@/lib/server/roomPresence";
import { getRoomCommercialState } from "@/lib/server/commercialEntitlements";
import { P2_BUILD_TAGS } from "@/lib/p2Status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ roomId: string }> };

export async function GET(req: Request, context: Context) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { roomId } = await context.params;
    const [presence, commercial] = await Promise.all([
      getRoomPresenceState(roomId, userId),
      getRoomCommercialState(roomId, userId),
    ]);
    return NextResponse.json(
      {
        ...presence,
        commercial_state: commercial,
        p2_build_tag: P2_BUILD_TAGS.entitlement,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status =
      message === "UNAUTHORIZED"
        ? 401
        : message === "ROOM_NOT_FOUND"
          ? 404
          : message === "NOT_A_MEMBER"
            ? 403
            : message === "ROOM_ENDED"
              ? 410
              : 500;
    return NextResponse.json(
      { error: message, build_tag: ROOM_PRESENCE_BUILD_TAG },
      { status },
    );
  }
}
