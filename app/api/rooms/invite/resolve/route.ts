import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";

export const runtime = "nodejs";

type ResolveBody = {
  inviteCode?: string;
};

function normalizeInviteCode(input?: string | null) {
  return (input ?? "").trim().toUpperCase();
}

export async function POST(req: Request) {
  try {
    await getAuthUserFromRequest(req);
    const body = (await req.json()) as ResolveBody;
    const inviteCode = normalizeInviteCode(body.inviteCode);

    if (!inviteCode) {
      return NextResponse.json({ error: "請先輸入邀請碼。" }, { status: 400 });
    }

    const roomResult = await supabaseAdmin
      .from("rooms")
      .select("id,title,duration_minutes,mode,max_size,created_at,room_category,interaction_style,visibility,host_note,invite_code")
      .eq("invite_code", inviteCode)
      .eq("visibility", "invited")
      .maybeSingle();

    if (roomResult.data) {
      return NextResponse.json({
        kind: "room",
        room: roomResult.data,
      });
    }

    const scheduleResult = await supabaseAdmin
      .from("scheduled_room_posts")
      .select("id,title,start_at,end_at,duration_minutes,seat_limit,room_category,interaction_style,visibility,note,invite_code")
      .eq("invite_code", inviteCode)
      .eq("visibility", "invited")
      .gt("start_at", new Date().toISOString())
      .maybeSingle();

    if (scheduleResult.data) {
      return NextResponse.json({
        kind: "schedule",
        post: scheduleResult.data,
      });
    }

    return NextResponse.json({ error: "找不到對應的邀請房或邀請排程。" }, { status: 404 });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "請先登入後再使用邀請碼。" }, { status: 401 });
    }
    return NextResponse.json({ error: error?.message || "Unexpected server error" }, { status: 500 });
  }
}
