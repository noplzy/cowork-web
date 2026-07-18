import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import {
  ROOM_PRESENCE_BUILD_TAG,
  recordRoomPresence,
  type RecordPresenceInput,
} from "@/lib/server/roomPresence";

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
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
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
