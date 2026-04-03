import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";

export const runtime = "nodejs";

type LeaveBody = {
  roomId?: string;
};

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const body = (await req.json()) as LeaveBody;
    const roomId = (body.roomId ?? "").trim();

    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
    }

    const result = await supabaseAdmin
      .from("room_members")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", userId);

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    const roomCheck = await supabaseAdmin
      .from("rooms")
      .select("id")
      .eq("id", roomId)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      roomDeleted: !roomCheck.data,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "請先登入後再離開同行空間。" }, { status: 401 });
    }
    return NextResponse.json({ error: error?.message || "Unexpected server error" }, { status: 500 });
  }
}
