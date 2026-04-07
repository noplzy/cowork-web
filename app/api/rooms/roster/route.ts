import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";

export const runtime = "nodejs";

type Body = { roomId?: string };

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const body = (await req.json()) as Body;
    const roomId = (body.roomId ?? "").trim();

    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
    }

    const { data: room, error: roomErr } = await supabaseAdmin
      .from("rooms")
      .select("id,created_by")
      .eq("id", roomId)
      .single();

    if (roomErr || !room) {
      return NextResponse.json({ error: roomErr?.message || "Room not found" }, { status: 404 });
    }

    const isOwner = room.created_by === userId;

    const { data: ownMembership, error: ownMembershipErr } = await supabaseAdmin
      .from("room_members")
      .select("room_id,user_id")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();

    if (ownMembershipErr) {
      return NextResponse.json({ error: ownMembershipErr.message }, { status: 500 });
    }

    if (!isOwner && !ownMembership) {
      return NextResponse.json({ error: "Not allowed to view room roster" }, { status: 403 });
    }

    const { data: members, error: membersErr } = await supabaseAdmin
      .from("room_members")
      .select("room_id,user_id")
      .eq("room_id", roomId);

    if (membersErr) {
      return NextResponse.json({ error: membersErr.message }, { status: 500 });
    }

    const memberRows = (members ?? []) as Array<{ room_id: string; user_id: string }>;
    const memberIds = Array.from(new Set([...memberRows.map((item) => item.user_id), room.created_by, userId]));

    let profiles: any[] = [];
    if (memberIds.length > 0) {
      const { data: profileRows, error: profilesErr } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .in("user_id", memberIds);

      if (profilesErr) {
        return NextResponse.json({ error: profilesErr.message }, { status: 500 });
      }

      profiles = profileRows ?? [];
    }

    const otherIds = memberIds.filter((id) => id !== userId);

    const [incomingReqResult, outgoingReqResult, friendshipsResult] = await Promise.all([
      otherIds.length > 0
        ? supabaseAdmin
            .from("friend_requests")
            .select("*")
            .eq("addressee_user_id", userId)
            .eq("status", "pending")
            .in("requester_user_id", otherIds)
        : Promise.resolve({ data: [], error: null } as any),
      otherIds.length > 0
        ? supabaseAdmin
            .from("friend_requests")
            .select("*")
            .eq("requester_user_id", userId)
            .eq("status", "pending")
            .in("addressee_user_id", otherIds)
        : Promise.resolve({ data: [], error: null } as any),
      supabaseAdmin
        .from("friendships")
        .select("*")
        .or(`user_low.eq.${userId},user_high.eq.${userId}`),
    ]);

    if (incomingReqResult.error) {
      return NextResponse.json({ error: incomingReqResult.error.message }, { status: 500 });
    }
    if (outgoingReqResult.error) {
      return NextResponse.json({ error: outgoingReqResult.error.message }, { status: 500 });
    }
    if (friendshipsResult.error) {
      return NextResponse.json({ error: friendshipsResult.error.message }, { status: 500 });
    }

    const friendships = ((friendshipsResult.data ?? []) as Array<{ user_low: string; user_high: string; created_at: string }>).filter((item) => {
      const otherId = item.user_low === userId ? item.user_high : item.user_low;
      return memberIds.includes(otherId);
    });

    return NextResponse.json({
      room: {
        id: room.id,
        created_by: room.created_by,
      },
      members: memberRows,
      profiles,
      incoming_requests: incomingReqResult.data ?? [],
      outgoing_requests: outgoingReqResult.data ?? [],
      friendships,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "請先登入後再查看房內名單。" }, { status: 401 });
    }
    return NextResponse.json({ error: error?.message || "Unexpected server error" }, { status: 500 });
  }
}
