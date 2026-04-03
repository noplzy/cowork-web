import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function isAuthorized(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const expected = process.env.CRON_SECRET?.trim();
  return Boolean(expected) && token === expected;
}

export async function GET(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await supabaseAdmin.rpc("cleanup_rooms_and_schedules");
    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, result: result.data ?? null });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unexpected server error" }, { status: 500 });
  }
}
