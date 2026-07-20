import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import {
  ROOM_PRESENCE_BUILD_TAG,
  recordRoomPresence,
  type RecordPresenceInput,
} from "@/lib/server/roomPresence";
import { consumeVisualSeconds } from "@/lib/server/commercialEntitlements";
import { P2_BUILD_TAGS } from "@/lib/p2Status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "UNAUTHORIZED") return 401;
  if (message === "MISSING_ROOM_ID") return 400;
  if (message === "ROOM_NOT_FOUND") return 404;
  if (message === "NOT_A_MEMBER") return 403;
  if (message === "ROOM_ENDED") return 410;
  return 500;
}

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const body = (await req.json().catch(() => ({}))) as Omit<
      RecordPresenceInput,
      "userId"
    >;
    const result = await recordRoomPresence({ ...body, userId });

    let commercialUsage: Record<string, unknown> | null = null;
    try {
      commercialUsage = await consumeVisualSeconds({
        userId,
        roomId: String(body.roomId || ""),
        accessSessionId: result.access_session_id || null,
        quantitySeconds: Number(result.delta_seconds_applied || 0),
        intervalMediaClass: String(result.interval_media_class || "unknown"),
        idempotencyKey: `presence:${result.event_id}:visual_seconds`,
      });
    } catch (error) {
      // Presence/liveness must not fail because a commercial projection is
      // temporarily unavailable. The response exposes a verifiable warning and
      // the next heartbeat will retry with a different event id.
      commercialUsage = {
        applied: false,
        allowed: true,
        downgradeRequired: false,
        warning:
          error instanceof Error ? error.message : "visual_wallet_unavailable",
        buildTag: P2_BUILD_TAGS.wallet,
      };
    }

    return NextResponse.json(
      {
        ...result,
        commercial_usage: commercialUsage,
        build_tag: ROOM_PRESENCE_BUILD_TAG,
        p2_build_tag: P2_BUILD_TAGS.wallet,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected server error",
        build_tag: ROOM_PRESENCE_BUILD_TAG,
      },
      { status: statusFor(error) },
    );
  }
}
