import { NextResponse } from "next/server";
import {
  getPublicRoomsBoardSnapshot,
  publicRoomsBoardCacheConfig,
} from "@/lib/server/publicRoomsBoard";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fresh = url.searchParams.get("fresh") === "1";

  const snapshot = await getPublicRoomsBoardSnapshot({ fresh });

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": fresh
        ? "no-store"
        : `public, max-age=0, s-maxage=${publicRoomsBoardCacheConfig.revalidateSeconds}, stale-while-revalidate=${publicRoomsBoardCacheConfig.staleWhileRevalidateSeconds}`,
      "X-CalmCo-Rooms-Board-Cache": snapshot.cacheState,
      "X-CalmCo-Rooms-Board-Build": snapshot.buildTag,
    },
  });
}
