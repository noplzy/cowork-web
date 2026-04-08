import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { areUsersFriends, getAuthUserFromRequest, isVipUser } from "@/lib/serverRoomUtils";

export const runtime = "nodejs";

type JoinBody = {
  roomId?: string;
  inviteCode?: string;
};

type RoomRow = {
  id: string;
  title: string;
  created_by: string;
  visibility: "public" | "members" | "friends" | "invited" | null;
  invite_code: string | null;
};

function normalizeInviteCode(input?: string | null) {
  return (input ?? "").trim().toUpperCase();
}

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const body = (await req.json()) as JoinBody;

    const roomId = (body.roomId ?? "").trim();
    const inviteCode = normalizeInviteCode(body.inviteCode);

    if (!roomId && !inviteCode) {
      return NextResponse.json({ error: "Missing roomId or inviteCode" }, { status: 400 });
    }

    let query = supabaseAdmin
      .from("rooms")
      .select("id,title,created_by,visibility,invite_code")
      .limit(1);

    if (roomId) {
      query = query.eq("id", roomId);
    } else {
      query = query.eq("invite_code", inviteCode);
    }

    const roomResult = await query.maybeSingle();
    const room = roomResult.data as RoomRow | null;

    if (roomResult.error || !room?.id) {
      return NextResponse.json({ error: "找不到對應的同行空間。" }, { status: 404 });
    }

    // Hotfix:
    // If the user is already in room_members, do not require inviteCode again.
    // This fixes the current bug where:
    // 1) user joins via invite flow,
    // 2) room_members already contains the user,
    // 3) room page retries join with only roomId,
    // 4) invited gate returns 403 even though membership already exists.
    const existingMemberResult = await supabaseAdmin
      .from("room_members")
      .select("room_id,user_id")
      .eq("room_id", room.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingMemberResult.error) {
      return NextResponse.json({ error: existingMemberResult.error.message }, { status: 500 });
    }

    if (existingMemberResult.data || room.created_by === userId) {
      return NextResponse.json({
        roomId: room.id,
        title: room.title,
        visibility: room.visibility,
        invite_code: room.visibility === "invited" ? room.invite_code : null,
        already_member: true,
      });
    }

    let allowed = false;

    if (room.visibility === "public") {
      allowed = true;
    } else if (room.visibility === "members") {
      allowed = await isVipUser(userId);
    } else if (room.visibility === "friends") {
      allowed = await areUsersFriends(userId, room.created_by);
    } else if (room.visibility === "invited") {
      allowed = inviteCode.length > 0 && inviteCode === normalizeInviteCode(room.invite_code);
    }

    if (!allowed) {
      return NextResponse.json({ error: "你目前沒有權限加入這間同行空間。" }, { status: 403 });
    }

    const joinResult = await supabaseAdmin
      .from("room_members")
      .upsert({ room_id: room.id, user_id: userId }, { onConflict: "room_id,user_id" });

    if (joinResult.error) {
      return NextResponse.json({ error: joinResult.error.message }, { status: 500 });
    }

    return NextResponse.json({
      roomId: room.id,
      title: room.title,
      visibility: room.visibility,
      invite_code: room.visibility === "invited" ? room.invite_code : null,
      already_member: false,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "請先登入後再加入同行空間。" }, { status: 401 });
    }
    return NextResponse.json({ error: error?.message || "Unexpected server error" }, { status: 500 });
  }
}
