import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  mapBuddyCategoryToRoomCategory,
  type BuddyServiceRow,
} from "@/lib/buddies";
import { createDailyPrivateRoom } from "@/lib/serverRoomUtils";
import {
  identityAccessErrorResponse,
  requireBuddiesRealNameVerifiedForRequest,
} from "@/lib/server/identityAccess";
import { requireBuddiesCommercialPilot } from "@/lib/server/buddySettlement";
import { P3_BUILD_TAGS } from "@/lib/p3Status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUDDY_ROOM_ROUTE_BUILD_TAG =
  "p3-buddy-room-null-safe-v1312-2026-07-22";

type Context = { params: Promise<{ bookingId: string }> };

async function existingRoom(roomId: string) {
  const result = await supabaseAdmin
    .from("rooms")
    .select("id,status,scheduled_end_at,daily_room_url")
    .eq("id", roomId)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}

export async function POST(req: Request, context: Context) {
  let createdRoomId: string | null = null;
  let userId = "";
  let bookingId = "";
  try {
    const auth = await requireBuddiesRealNameVerifiedForRequest(req);
    userId = auth.userId;
    requireBuddiesCommercialPilot(userId);
    ({ bookingId } = await context.params);

    let claim = await supabaseAdmin.rpc("cowork_claim_buddy_room_provision_v3", {
      p_booking_id: bookingId,
      p_user_id: userId,
      p_early_minutes: 15,
      p_late_minutes: 15,
    });
    if (claim.error) {
      const tooEarly = /TOO_EARLY/.test(claim.error.message);
      const windowEnded = /WINDOW_ENDED/.test(claim.error.message);
      const status = tooEarly ? 425 : windowEnded ? 410 : 409;
      const code = tooEarly
        ? "BUDDY_ROOM_TOO_EARLY"
        : windowEnded
          ? "BUDDY_ROOM_WINDOW_ENDED"
          : "BUDDY_ROOM_NOT_READY";
      return NextResponse.json(
        {
          error: claim.error.message,
          code,
          build_tag: P3_BUILD_TAGS.buddiesCommercial,
          route_build_tag: BUDDY_ROOM_ROUTE_BUILD_TAG,
        },
        { status },
      );
    }
    let claimData = claim.data as any;
    let booking = claimData?.booking;
    if (claimData?.ready && booking?.linked_room_id) {
      const room = await existingRoom(booking.linked_room_id);
      if (room?.status === "active" && room.daily_room_url) {
        return NextResponse.json({
          room,
          booking,
          created: false,
          build_tag: P3_BUILD_TAGS.buddiesCommercial,
          route_build_tag: BUDDY_ROOM_ROUTE_BUILD_TAG,
        });
      }
      await supabaseAdmin
        .from("buddy_bookings")
        .update({
          linked_room_id: null,
          linked_room_invite_code: null,
          room_provision_status: "failed",
          room_provision_error: "linked_room_missing_or_inactive",
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId);
      claim = await supabaseAdmin.rpc("cowork_claim_buddy_room_provision_v3", {
        p_booking_id: bookingId,
        p_user_id: userId,
        p_early_minutes: 15,
        p_late_minutes: 15,
      });
      if (claim.error) throw claim.error;
      claimData = claim.data as any;
      booking = claimData?.booking;
    }
    if (!claimData?.claimed) {
      return NextResponse.json(
        {
          error: "履約房正在由另一個請求建立，請稍後再試。",
          code: "BUDDY_ROOM_PROVISION_IN_PROGRESS",
          build_tag: P3_BUILD_TAGS.buddiesCommercial,
          route_build_tag: BUDDY_ROOM_ROUTE_BUILD_TAG,
        },
        { status: 409 },
      );
    }

    const service = await supabaseAdmin
      .from("buddy_services")
      .select("*")
      .eq("id", booking.service_id)
      .maybeSingle();
    if (service.error || !service.data) throw service.error || new Error("找不到履約服務。");

    const now = new Date();
    const scheduledEnd = new Date(booking.scheduled_end_at);
    const durationMinutes = Number(booking.hours_booked || 1) >= 2 ? 90 : 50;
    const insertRoom = await supabaseAdmin
      .from("rooms")
      .insert({
        title: `${service.data.title}｜安感夥伴履約房`,
        duration_minutes: durationMinutes,
        mode: "pair",
        max_size: 2,
        created_by: booking.provider_user_id,
        room_category: mapBuddyCategoryToRoomCategory(
          (service.data as BuddyServiceRow).buddy_category,
        ),
        interaction_style: service.data.interaction_style,
        visibility: "invited",
        host_note: "P3 遠端 Buddies 履約房。付款、雙方完成、爭議與結算皆有可回查紀錄。",
        status: "active",
        started_at: now.toISOString(),
        scheduled_end_at: scheduledEnd.toISOString(),
      })
      .select("id,invite_code")
      .single();
    if (insertRoom.error || !insertRoom.data) {
      throw insertRoom.error || new Error("建立履約房失敗。");
    }
    const provisionedRoomId = String(insertRoom.data.id ?? "").trim();
    if (!provisionedRoomId) {
      throw new Error("建立履約房失敗：rooms.id 缺失。");
    }
    createdRoomId = provisionedRoomId;

    const members = await supabaseAdmin.from("room_members").insert([
      { room_id: provisionedRoomId, user_id: booking.provider_user_id },
      { room_id: provisionedRoomId, user_id: booking.buyer_user_id },
    ]);
    if (members.error) throw members.error;

    const roomName = `buddy_${provisionedRoomId.replaceAll("-", "")}`;
    const daily = await createDailyPrivateRoom(roomName);
    const updatedRoom = await supabaseAdmin
      .from("rooms")
      .update({ daily_room_url: daily.url })
      .eq("id", provisionedRoomId)
      .select("id,status,scheduled_end_at,daily_room_url")
      .single();
    if (updatedRoom.error || !updatedRoom.data) {
      throw updatedRoom.error || new Error("更新 Daily 履約房失敗。");
    }

    const finished = await supabaseAdmin.rpc("cowork_finish_buddy_room_provision_v3", {
      p_booking_id: bookingId,
      p_actor_user_id: userId,
      p_room_id: provisionedRoomId,
      p_invite_code: insertRoom.data.invite_code ?? null,
      p_error: null,
    });
    if (finished.error) throw finished.error;

    return NextResponse.json({
      room: updatedRoom.data,
      booking: finished.data,
      created: true,
      token_policy: "private_room_short_lived_meeting_token_issued_by_existing_route",
      build_tag: P3_BUILD_TAGS.buddiesCommercial,
      route_build_tag: BUDDY_ROOM_ROUTE_BUILD_TAG,
    });
  } catch (error: any) {
    if (createdRoomId) {
      await supabaseAdmin.from("room_members").delete().eq("room_id", createdRoomId);
      await supabaseAdmin.from("rooms").delete().eq("id", createdRoomId);
    }
    if (bookingId && userId) {
      try {
        await supabaseAdmin.rpc("cowork_finish_buddy_room_provision_v3", {
          p_booking_id: bookingId,
          p_actor_user_id: userId,
          p_room_id: null,
          p_invite_code: null,
          p_error: error?.message || "room_provision_failed",
        });
      } catch {
        // Preserve the original provisioning error.
      }
    }
    const mapped = identityAccessErrorResponse(error, P3_BUILD_TAGS.buddiesCommercial);
    if (mapped) return mapped;
    return NextResponse.json(
      {
        error: error?.message || "建立履約房失敗。",
        build_tag: P3_BUILD_TAGS.buddiesCommercial,
        route_build_tag: BUDDY_ROOM_ROUTE_BUILD_TAG,
      },
      { status: Number(error?.status || 500) },
    );
  }
}
