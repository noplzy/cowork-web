import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { areUsersFriends, getAuthUserFromRequest, isVipUser } from "@/lib/serverRoomUtils";

export const runtime = "nodejs";

type Body = {
  roomId?: string;
  inviteCode?: string;
};

function normalizeInviteCode(input?: string | null) {
  return (input ?? "").trim().toUpperCase();
}

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const body = (await req.json()) as Body;
    const roomId = (body.roomId ?? "").trim();
    const inviteCode = normalizeInviteCode(body.inviteCode);

    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
    }

    const roomResult = await supabaseAdmin
      .from("rooms")
      .select("id,title,duration_minutes,mode,max_size,created_at,created_by,daily_room_url,visibility,invite_code")
      .eq("id", roomId)
      .maybeSingle();

    const room = roomResult.data as any;

    if (roomResult.error || !room?.id) {
      return NextResponse.json({ error: roomResult.error?.message || "Room not found" }, { status: 404 });
    }

    const membershipResult = await supabaseAdmin
      .from("room_members")
      .select("room_id,user_id")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipResult.error) {
      return NextResponse.json({ error: membershipResult.error.message }, { status: 500 });
    }

    const isOwner = room.created_by === userId;
    const isMember = isOwner || Boolean(membershipResult.data);
    const visibility = (room.visibility ?? "public") as "public" | "members" | "friends" | "invited";
    const normalizedRoomInviteCode = normalizeInviteCode(room.invite_code);

    let canJoin = isMember;
    let requiresInviteCode = false;

    if (!canJoin) {
      if (visibility === "public") {
        canJoin = true;
      } else if (visibility === "members") {
        canJoin = await isVipUser(userId);
      } else if (visibility === "friends") {
        canJoin = await areUsersFriends(userId, room.created_by);
      } else if (visibility === "invited") {
        requiresInviteCode = true;
        canJoin = inviteCode.length > 0 && inviteCode === normalizedRoomInviteCode;
      }
    }

    if (!isMember && !canJoin && (visibility === "members" || visibility === "friends")) {
      return NextResponse.json({ error: "你目前沒有權限查看這間同行空間。" }, { status: 403 });
    }

    return NextResponse.json({
      room: {
        ...room,
        invite_code: isMember ? room.invite_code : null,
      },
      is_owner: isOwner,
      is_member: isMember,
      can_join: canJoin,
      requires_invite_code: requiresInviteCode,
      invite_code_accepted: visibility === "invited" ? inviteCode.length > 0 && inviteCode === normalizedRoomInviteCode : false,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "請先登入後再查看同行空間。" }, { status: 401 });
    }
    return NextResponse.json({ error: error?.message || "Unexpected server error" }, { status: 500 });
  }
}
