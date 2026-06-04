import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createDailyPrivateRoom, getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { ROOM_INFRA_BUILD_TAG, addMinutes } from "@/lib/server/roomInfra";
import { isAllowedGeneralRoomDuration, normalizeGroupSize, ROOM_CATEGORIES } from "@/lib/productCatalog";

export const runtime = "nodejs";

type CreateRoomBody = {
  title?: string;
  duration_minutes?: number;
  mode?: "pair" | "group";
  max_size?: number;
  room_category?: "focus" | "life" | "share" | "hobby";
  interaction_style?: "silent" | "light-chat" | "guided" | "open-share";
  visibility?: "public" | "members" | "friends" | "invited";
  host_note?: string | null;
};

const ROOM_SELECT = "id,title,duration_minutes,mode,max_size,created_by,daily_room_url,room_category,interaction_style,visibility,host_note,invite_code,created_at,status,started_at,scheduled_end_at,ended_at,last_presence_at,cleanup_reason";
const VALID_CATEGORIES = new Set(ROOM_CATEGORIES.map((category) => category.code));

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const body = (await req.json()) as CreateRoomBody;

    const title = (body.title ?? "").trim().slice(0, 80);
    const durationMinutes = Number(body.duration_minutes ?? 50);
    const mode = body.mode === "pair" ? "pair" : "group";
    const maxSize = normalizeGroupSize(body.max_size, mode);
    const roomCategory = (body.room_category ?? "focus") as CreateRoomBody["room_category"];
    const interactionStyle = (body.interaction_style ?? "silent") as CreateRoomBody["interaction_style"];
    const visibility = (body.visibility ?? "public") as CreateRoomBody["visibility"];
    const hostNote = (body.host_note ?? "").trim() || null;

    if (!title) {
      return NextResponse.json({ error: "請先填寫同行空間名稱。", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 400 });
    }

    if (!isAllowedGeneralRoomDuration(durationMinutes)) {
      return NextResponse.json({ error: "一般即時同行空間目前只支援 25 / 50 / 75 分鐘；90 分鐘保留給活動房，100 分鐘不再是正式規格。", code: "UNSUPPORTED_ROOM_DURATION", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 400 });
    }

    if (!VALID_CATEGORIES.has(roomCategory ?? "focus")) {
      return NextResponse.json({ error: "同行空間目前只支援專注任務、生活陪伴、主題分享、興趣同好。", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 400 });
    }

    const now = new Date();
    const scheduledEndAt = addMinutes(now, durationMinutes).toISOString();

    const insertRoom = await supabaseAdmin
      .from("rooms")
      .insert({
        title,
        duration_minutes: durationMinutes,
        mode,
        max_size: maxSize,
        created_by: userId,
        room_category: roomCategory,
        interaction_style: interactionStyle,
        visibility,
        host_note: hostNote,
        status: "active",
        started_at: now.toISOString(),
        scheduled_end_at: scheduledEndAt,
      })
      .select(ROOM_SELECT)
      .single();

    if (insertRoom.error || !insertRoom.data) {
      return NextResponse.json({ error: insertRoom.error?.message ?? "建立同行空間失敗。", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 400 });
    }

    const room = insertRoom.data as any;
    const roomMember = await supabaseAdmin.from("room_members").insert({ room_id: room.id, user_id: userId });

    if (roomMember.error) {
      await supabaseAdmin.from("rooms").delete().eq("id", room.id);
      return NextResponse.json({ error: roomMember.error.message, build_tag: ROOM_INFRA_BUILD_TAG }, { status: 500 });
    }

    try {
      const roomName = `cowork_${String(room.id).replaceAll("-", "")}`;
      const created = await createDailyPrivateRoom(roomName);
      const updateRoom = await supabaseAdmin.from("rooms").update({ daily_room_url: created.url }).eq("id", room.id).select(ROOM_SELECT).single();

      if (updateRoom.error || !updateRoom.data) throw new Error(updateRoom.error?.message ?? "更新 Daily 房間失敗");
      return NextResponse.json({ room: updateRoom.data, invite_code: (updateRoom.data as any).invite_code ?? null, build_tag: ROOM_INFRA_BUILD_TAG });
    } catch (error: any) {
      await supabaseAdmin.from("room_members").delete().eq("room_id", room.id).eq("user_id", userId);
      await supabaseAdmin.from("rooms").delete().eq("id", room.id);
      return NextResponse.json({ error: error?.message || "建立 Daily 房間失敗。", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 500 });
    }
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "請先登入後再建立同行空間。", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 401 });
    return NextResponse.json({ error: error?.message || "Unexpected server error", build_tag: ROOM_INFRA_BUILD_TAG }, { status: 500 });
  }
}
