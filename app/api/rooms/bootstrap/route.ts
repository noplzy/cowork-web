import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { areUsersFriends, getAuthUserFromRequest, isVipUser } from "@/lib/serverRoomUtils";
import { ROOM_INFRA_BUILD_TAG, isRoomEndedOrExpired } from "@/lib/server/roomInfra";

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
      return NextResponse.json({ error: "Missing roomId", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 400 });
    }

    const roomResult = await supabaseAdmin
      .from("rooms")
      .select("id,title,duration_minutes,mode,max_size,created_at,created_by,daily_room_url,visibility,invite_code,status,started_at,scheduled_end_at,ended_at,last_presence_at,cleanup_reason")
      .eq("id", roomId)
      .maybeSingle();

    const room = roomResult.data as any;

    if (roomResult.error || !room?.id) {
      return NextResponse.json({ error: roomResult.error?.message || "Room not found", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 404 });
    }

    if (isRoomEndedOrExpired(room, 3)) {
      return NextResponse.json({ error: "這間同行空間已結束。", code: "ROOM_ENDED", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 410 });
    }

    const membershipResult = await supabaseAdmin
      .from("room_members")
      .select("room_id,user_id")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipResult.error) {
      return NextResponse.json({ error: membershipResult.error.message, build_tag: ROOM_INFRA_BUILD_TAG }, { status: 500 });
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
      return NextResponse.json({ error: "你目前沒有權限查看這間同行空間。", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 403 });
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
      build_tag: ROOM_INFRA_BUILD_TAG,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "請先登入後再查看同行空間。", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 401 });
    }
    return NextResponse.json({ error: error?.message || "Unexpected server error", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 500 });
  }
}
