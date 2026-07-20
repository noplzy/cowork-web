import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createDailyPrivateRoom } from "@/lib/serverRoomUtils";
import { ROOM_INFRA_BUILD_TAG, addMinutes } from "@/lib/server/roomInfra";
import {
  isAllowedGeneralRoomDuration,
  normalizeGroupSize,
  ROOM_CATEGORIES,
} from "@/lib/productCatalog";
import {
  identityAccessErrorResponse,
  requirePhoneVerifiedForRequest,
} from "@/lib/server/identityAccess";
import { requireRoomsCreationEntitlement } from "@/lib/server/commercialEntitlements";
import { isP2RoomCreationGateEnabled, P2_BUILD_TAGS } from "@/lib/p2Status";

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

const ROOM_SELECT =
  "id,title,duration_minutes,mode,max_size,created_by,daily_room_url,room_category,interaction_style,visibility,host_note,invite_code,created_at,status,started_at,scheduled_end_at,ended_at,last_presence_at,cleanup_reason";
const VALID_CATEGORIES = new Set(ROOM_CATEGORIES.map((item) => item.code));

export async function POST(req: Request) {
  try {
    const { userId } = await requirePhoneVerifiedForRequest(req);
    const body = (await req.json()) as CreateRoomBody;
    const title = String(body.title || "").trim().slice(0, 80);
    const durationMinutes = Number(body.duration_minutes || 50);
    const mode = body.mode === "pair" ? "pair" : "group";
    const maxSize = normalizeGroupSize(body.max_size, mode);
    const roomCategory = body.room_category || "focus";
    const interactionStyle = body.interaction_style || "silent";
    const visibility = body.visibility || "public";
    const hostNote = String(body.host_note || "").trim() || null;

    if (!title) {
      return NextResponse.json(
        { error: "請先填寫同行空間名稱。", build_tag: ROOM_INFRA_BUILD_TAG },
        { status: 400 },
      );
    }
    if (!isAllowedGeneralRoomDuration(durationMinutes)) {
      return NextResponse.json(
        {
          error: "一般即時同行空間目前只支援 25 / 50 / 75 分鐘；90 分鐘保留給活動房，100 分鐘不再是正式規格。",
          code: "UNSUPPORTED_ROOM_DURATION",
          build_tag: ROOM_INFRA_BUILD_TAG,
        },
        { status: 400 },
      );
    }
    if (!VALID_CATEGORIES.has(roomCategory)) {
      return NextResponse.json(
        {
          error: "同行空間目前只支援專注任務、生活陪伴、主題分享、興趣同好。",
          build_tag: ROOM_INFRA_BUILD_TAG,
        },
        { status: 400 },
      );
    }

    let entitlement = null;
    if (isP2RoomCreationGateEnabled()) {
      try {
        entitlement = await requireRoomsCreationEntitlement(userId);
      } catch (error: any) {
        if (error?.message === "ROOM_CREATION_REQUIRES_ROOMS_PLAN") {
          return NextResponse.json(
            {
              error: "建立私人同行空間需要 Rooms 方案；免費使用者仍可加入公開體驗房。",
              code: "ROOM_CREATION_REQUIRES_ROOMS_PLAN",
              entitlement: error.snapshot || null,
              build_tag: P2_BUILD_TAGS.entitlement,
            },
            { status: 402 },
          );
        }
        throw error;
      }
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
      return NextResponse.json(
        {
          error: insertRoom.error?.message || "建立同行空間失敗。",
          build_tag: ROOM_INFRA_BUILD_TAG,
        },
        { status: 400 },
      );
    }

    const room = insertRoom.data as any;
    const member = await supabaseAdmin.from("room_members").insert({
      room_id: room.id,
      user_id: userId,
    });
    if (member.error) {
      await supabaseAdmin.from("rooms").delete().eq("id", room.id);
      return NextResponse.json(
        { error: member.error.message, build_tag: ROOM_INFRA_BUILD_TAG },
        { status: 500 },
      );
    }

    try {
      const roomName = `cowork_${String(room.id).replaceAll("-", "")}`;
      const created = await createDailyPrivateRoom(roomName);
      const updated = await supabaseAdmin
        .from("rooms")
        .update({ daily_room_url: created.url })
        .eq("id", room.id)
        .select(ROOM_SELECT)
        .single();
      if (updated.error || !updated.data) {
        throw new Error(updated.error?.message || "更新 Daily 房間失敗");
      }
      return NextResponse.json({
        room: updated.data,
        invite_code: (updated.data as any).invite_code || null,
        room_creation_gate_enabled: isP2RoomCreationGateEnabled(),
        entitlement_plan: entitlement?.planCode || null,
        build_tag: ROOM_INFRA_BUILD_TAG,
      });
    } catch (error) {
      await supabaseAdmin
        .from("room_members")
        .delete()
        .eq("room_id", room.id)
        .eq("user_id", userId);
      await supabaseAdmin.from("rooms").delete().eq("id", room.id);
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "建立 Daily 房間失敗。",
          build_tag: ROOM_INFRA_BUILD_TAG,
        },
        { status: 500 },
      );
    }
  } catch (error) {
    const mapped = identityAccessErrorResponse(error, ROOM_INFRA_BUILD_TAG);
    if (mapped) return mapped;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected server error",
        build_tag: ROOM_INFRA_BUILD_TAG,
      },
      { status: 500 },
    );
  }
}
