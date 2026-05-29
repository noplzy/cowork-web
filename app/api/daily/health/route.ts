import { NextResponse } from "next/server";
import { ROOM_INFRA_BUILD_TAG } from "@/lib/server/roomInfra";

export const runtime = "nodejs";

export async function GET() {
  const dailyKey = process.env.DAILY_API_KEY;
  const dailyApiBase = process.env.DAILY_API_BASE || "https://api.daily.co/v1";

  if (!dailyKey) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        error: "Missing DAILY_API_KEY",
        build_tag: ROOM_INFRA_BUILD_TAG,
      },
      { status: 500 }
    );
  }

  const startedAt = Date.now();

  try {
    const response = await fetch(`${dailyApiBase}/rooms?limit=1`, {
      method: "GET",
      headers: { Authorization: `Bearer ${dailyKey}` },
      cache: "no-store",
    });

    const latencyMs = Date.now() - startedAt;
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          configured: true,
          daily_api_base: dailyApiBase,
          status: response.status,
          latency_ms: latencyMs,
          error: payload?.info || payload?.error || "Daily health check failed",
          build_tag: ROOM_INFRA_BUILD_TAG,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      ok: true,
      configured: true,
      daily_api_base: dailyApiBase,
      status: response.status,
      latency_ms: latencyMs,
      sample_count: Array.isArray(payload?.data) ? payload.data.length : null,
      build_tag: ROOM_INFRA_BUILD_TAG,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        daily_api_base: dailyApiBase,
        error: error?.message || "Daily health check exception",
        build_tag: ROOM_INFRA_BUILD_TAG,
      },
      { status: 500 }
    );
  }
}
