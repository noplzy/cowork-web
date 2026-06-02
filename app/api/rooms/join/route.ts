import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { areUsersFriends, getAuthUserFromRequest, isVipUser } from "@/lib/serverRoomUtils";
import { ROOM_INFRA_BUILD_TAG, isRoomEndedOrExpired } from "@/lib/server/roomInfra";
import { userBlockExists } from "@/lib/server/safety";

export const runtime = "nodejs";

type JoinBody = {
  roomId?: string;
  inviteCode?: string;
};

function normalizeInviteCode(input?: string | null) {
  return (input ?? "").trim().toUpperCase();
}

function joinErrorResponse(code?: string, payload?: any) {
  if (code === "ROOM_FULL") {
    return NextResponse.json(
      { error: "這間同行空間目前已滿。", code, ...payload, build_tag: ROOM_INFRA_BUILD_TAG },
      { status: 409 }
    );
  }

  if (code === "ROOM_ENDED" || code === "ROOM_EXPIRED") {
    return NextResponse.json(
      { error: "這間同行空間已結束。", code, ...payload, build_tag: ROOM_INFRA_BUILD_TAG },
      { status: 410 }
    );
  }

  if (code === "ROOM_NOT_FOUND") {
    return NextResponse.json(
      { error: "找不到對應的同行空間。", code, build_tag: ROOM_INFRA_BUILD_TAG },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { error: "加入同行空間失敗。", code: code || "JOIN_FAILED", ...payload, build_tag: ROOM_INFRA_BUILD_TAG },
    { status: 400 }
  );
}

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const body = (await req.json()) as JoinBody;

    const roomId = (body.roomId ?? "").trim();
    const inviteCode = normalizeInviteCode(body.inviteCode);

    if (!roomId && !inviteCode) {
      return NextResponse.json({ error: "Missing roomId or inviteCode", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 400 });
    }

    let query = supabaseAdmin
      .from("rooms")
      .select("id,title,created_by,created_at,duration_minutes,mode,max_size,visibility,invite_code,status,scheduled_end_at,ended_at")
      .limit(1);

    if (roomId) {
      query = query.eq("id", roomId);
    } else {
      query = query.eq("invite_code", inviteCode);
    }

    const roomResult = await query.maybeSingle();
    const room = roomResult.data as any;

    if (roomResult.error || !room?.id) {
      return NextResponse.json({ error: "找不到對應的同行空間。", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 404 });
    }

    if (isRoomEndedOrExpired(room, 3)) {
      return NextResponse.json({ error: "這間同行空間已結束。", code: "ROOM_ENDED", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 410 });
    }

    const blocked = await userBlockExists(userId, room.created_by);
    if (blocked) {
      return NextResponse.json(
        { error: "你目前無法加入這間同行空間。", code: "BLOCKED_BY_SAFETY_GATE", build_tag: ROOM_INFRA_BUILD_TAG },
        { status: 403 }
      );
    }

    const existingMembership = await supabaseAdmin
      .from("room_members")
      .select("room_id,user_id")
      .eq("room_id", room.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingMembership.error) {
      return NextResponse.json({ error: existingMembership.error.message, build_tag: ROOM_INFRA_BUILD_TAG }, { status: 500 });
    }

    if (existingMembership.data || room.created_by === userId) {
      return NextResponse.json({
        roomId: room.id,
        title: room.title,
        visibility: room.visibility,
        invite_code: room.visibility === "invited" ? room.invite_code : null,
        alreadyMember: true,
        build_tag: ROOM_INFRA_BUILD_TAG,
      });
    }

    const visibility = (room.visibility ?? "public") as "public" | "members" | "friends" | "invited";
    let allowed = false;

    if (visibility === "public") {
      allowed = true;
    } else if (visibility === "members") {
      allowed = await isVipUser(userId);
    } else if (visibility === "friends") {
      allowed = await areUsersFriends(userId, room.created_by);
    } else if (visibility === "invited") {
      allowed = inviteCode.length > 0 && inviteCode === normalizeInviteCode(room.invite_code);
    }

    if (!allowed) {
      return NextResponse.json({ error: "你目前沒有權限加入這間同行空間。", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 403 });
    }

    const joinResult = await supabaseAdmin.rpc("cowork_join_room_with_capacity", {
      p_room_id: room.id,
      p_user_id: userId,
    });

    if (joinResult.error) {
      return NextResponse.json({ error: joinResult.error.message, build_tag: ROOM_INFRA_BUILD_TAG }, { status: 500 });
    }

    const payload = (joinResult.data ?? {}) as any;
    if (!payload.ok) {
      return joinErrorResponse(payload.code, payload);
    }

    return NextResponse.json({
      roomId: room.id,
      title: room.title,
      visibility: room.visibility,
      invite_code: room.visibility === "invited" ? room.invite_code : null,
      alreadyMember: Boolean(payload.already_member),
      member_count: payload.member_count ?? null,
      max_size: payload.max_size ?? (room.mode === "pair" ? 2 : room.max_size),
      build_tag: ROOM_INFRA_BUILD_TAG,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "請先登入後再加入同行空間。", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 401 });
    }
    return NextResponse.json({ error: error?.message || "Unexpected server error", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 500 });
  }
}
