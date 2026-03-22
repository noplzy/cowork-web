// app/api/daily/create-room/route.ts
// Daily REST API: POST /rooms
// 重要：room properties 欄位是 enable_screenshare（不是 enable_screen_share）
// 4A Hotfix：加 start_audio_off=true，避免沒有麥克風/已拔除麥克風時 join 遇到 NotFoundError

import { NextResponse } from "next/server";

export const runtime = "nodejs";

type CreateRoomRequest = {
  roomName?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateRoomRequest;
    const roomName = (body?.roomName || "").trim();

    const apiKey = process.env.DAILY_API_KEY;
    const apiBase = process.env.DAILY_API_BASE || "https://api.daily.co/v1";

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing DAILY_API_KEY in server env" },
        { status: 500 }
      );
    }

    if (!roomName) {
      return NextResponse.json(
        { error: "Missing roomName" },
        { status: 400 }
      );
    }

    // private room：需要 meeting token 才能直接加入（我們會在前端加 ?t=TOKEN）
    const payload: any = {
      name: roomName,
      privacy: "private",
      properties: {
        max_participants: 6,
        enable_screenshare: true,
        enable_knocking: false,
        enable_video_processing_ui: true,

        // 關鍵：加入時不要自動打開麥克風（避免 No Mic / 已拔除麥克風 造成 NotFoundError）
        start_audio_off: true,
      },
    };

    const resp = await fetch(`${apiBase}/rooms`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await resp.json().catch(() => ({}));

    // Idempotency: if the room already exists, Daily returns 409.
    // For our UI we treat this as "ok" and just return the existing room.
    if (resp.status === 409) {
      const getResp = await fetch(`${apiBase}/rooms/${encodeURIComponent(roomName)}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      const existing = await getResp.json().catch(() => ({}));
      const existingUrl = existing?.url;

      if (getResp.ok && existingUrl) {
        return NextResponse.json({ url: existingUrl, raw: existing, existed: true });
      }

      // Fallback: keep the original 409 error details if we cannot fetch the room.
      return NextResponse.json(
        {
          error:
            json?.info ||
            json?.error ||
            existing?.info ||
            existing?.error ||
            "Daily room already exists, but failed to fetch it",
          raw: { create: json, get: existing },
        },
        { status: 409 }
      );
    }

    if (!resp.ok) {
      return NextResponse.json(
        { error: json?.info || json?.error || "Daily create-room failed", raw: json },
        { status: resp.status }
      );
    }

    const url = json?.url;
    if (!url) {
      return NextResponse.json(
        { error: "Daily created room but missing url", raw: json },
        { status: 500 }
      );
    }

    return NextResponse.json({ url, raw: json });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
