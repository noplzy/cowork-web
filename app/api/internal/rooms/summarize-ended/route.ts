import { NextResponse } from "next/server";
import { isInternalCronRequest } from "@/lib/server/roomInfra";
import {
  ROOM_SUMMARY_BUILD_TAG,
  summarizeEndedRooms,
} from "@/lib/server/roomSummary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function run(req: Request) {
  if (!isInternalCronRequest(req)) {
    return NextResponse.json(
      { error: "Unauthorized", build_tag: ROOM_SUMMARY_BUILD_TAG },
      { status: 401 },
    );
  }

  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") || 25);
    const result = await summarizeEndedRooms(limit);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected server error",
        build_tag: ROOM_SUMMARY_BUILD_TAG,
      },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}
