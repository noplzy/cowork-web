import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createDailyPrivateRoom, getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { BUDDIES_BUILD_TAG, mapBuddyCategoryToRoomCategory, type BuddyBookingRow, type BuddyServiceRow } from "@/lib/buddies";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ bookingId: string }> };
type PatchBody = { action?: "accept" | "decline" | "cancel" | "complete"; provider_note?: string | null };

async function createFulfillmentRoom(service: BuddyServiceRow, booking: BuddyBookingRow) {
  const title = `${service.title}｜履約房`;
  const roomCategory = mapBuddyCategoryToRoomCategory(service.buddy_category);

  const insertRoom = await supabaseAdmin
    .from("rooms")
    .insert({
      title,
      duration_minutes: booking.hours_booked >= 2 ? 50 : 25,
      mode: "pair",
      max_size: 2,
      created_by: booking.provider_user_id,
      room_category: roomCategory,
      interaction_style: service.interaction_style,
      visibility: "invited",
      host_note: "這是安感夥伴預約成立後自動建立的履約房。",
    })
    .select("id,invite_code")
    .single();

  if (insertRoom.error || !insertRoom.data) {
    throw new Error(insertRoom.error?.message ?? "建立履約房失敗。");
  }

  const roomId = insertRoom.data.id as string;
  const inviteCode = (insertRoom.data as any).invite_code ?? null;

  const memberResult = await supabaseAdmin.from("room_members").insert([
    { room_id: roomId, user_id: booking.provider_user_id },
    { room_id: roomId, user_id: booking.buyer_user_id },
  ]);

  if (memberResult.error) {
    await supabaseAdmin.from("rooms").delete().eq("id", roomId);
    throw new Error(memberResult.error.message);
  }

  try {
    const roomName = `buddy_${String(roomId).replaceAll("-", "")}`;
    const created = await createDailyPrivateRoom(roomName);
    const updateRoom = await supabaseAdmin
      .from("rooms")
      .update({ daily_room_url: created.url })
      .eq("id", roomId)
      .select("id")
      .single();

    if (updateRoom.error || !updateRoom.data) {
      throw new Error(updateRoom.error?.message ?? "更新履約房 Daily URL 失敗。");
    }

    return { roomId, inviteCode };
  } catch (error: any) {
    await supabaseAdmin.from("room_members").delete().eq("room_id", roomId);
    await supabaseAdmin.from("rooms").delete().eq("id", roomId);
    throw error;
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { bookingId } = await context.params;
    const body = (await req.json()) as PatchBody;
    const action = body.action;
    const providerNote = (body.provider_note ?? "").trim().slice(0, 800) || null;

    const bookingResult = await supabaseAdmin.from("buddy_bookings").select("*").eq("id", bookingId).maybeSingle();
    const booking = bookingResult.data as BuddyBookingRow | null;

    if (bookingResult.error || !booking) {
      return NextResponse.json({ error: bookingResult.error?.message ?? "找不到這筆預約。", build_tag: BUDDIES_BUILD_TAG }, { status: 404 });
    }

    if (!action || !["accept", "decline", "cancel", "complete"].includes(action)) {
      return NextResponse.json({ error: "無效的預約動作。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }

    if (action === "accept" || action === "decline") {
      if (booking.provider_user_id !== userId) {
        return NextResponse.json({ error: "只有服務提供者可以回覆這筆預約。", build_tag: BUDDIES_BUILD_TAG }, { status: 403 });
      }
    } else if (action === "cancel") {
      if (booking.provider_user_id !== userId && booking.buyer_user_id !== userId) {
        return NextResponse.json({ error: "只有預約雙方可以取消。", build_tag: BUDDIES_BUILD_TAG }, { status: 403 });
      }
    } else if (action === "complete") {
      if (booking.provider_user_id !== userId && booking.buyer_user_id !== userId) {
        return NextResponse.json({ error: "只有預約雙方可以標記完成。", build_tag: BUDDIES_BUILD_TAG }, { status: 403 });
      }
    }

    const nextStatus =
      action === "accept" ? "accepted" :
      action === "decline" ? "declined" :
      action === "cancel" ? "cancelled" : "completed";

    let linkedRoomId = booking.linked_room_id;
    let linkedInviteCode = booking.linked_room_invite_code;

    if (action === "accept") {
      if (booking.booking_status !== "pending") {
        return NextResponse.json({ error: "只有待回覆的預約可以接受。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
      }

      const serviceResult = await supabaseAdmin.from("buddy_services").select("*").eq("id", booking.service_id).maybeSingle();
      const service = serviceResult.data as BuddyServiceRow | null;
      if (serviceResult.error || !service) {
        return NextResponse.json({ error: serviceResult.error?.message ?? "找不到對應服務。", build_tag: BUDDIES_BUILD_TAG }, { status: 404 });
      }

      const room = await createFulfillmentRoom(service, booking);
      linkedRoomId = room.roomId;
      linkedInviteCode = room.inviteCode;

      await supabaseAdmin.from("buddy_service_slots").update({ slot_status: "booked" }).eq("id", booking.slot_id);
    }

    if ((action === "decline" || action === "cancel") && booking.slot_id) {
      await supabaseAdmin
        .from("buddy_service_slots")
        .update({ slot_status: "open" })
        .eq("id", booking.slot_id)
        .neq("slot_status", "booked");
    }

    const updatePayload: Record<string, string | null> = {
      booking_status: nextStatus,
      provider_note: providerNote,
    };
    if (linkedRoomId) updatePayload.linked_room_id = linkedRoomId;
    if (linkedInviteCode) updatePayload.linked_room_invite_code = linkedInviteCode;

    const updateResult = await supabaseAdmin
      .from("buddy_bookings")
      .update(updatePayload)
      .eq("id", booking.id)
      .select("*")
      .single();

    if (updateResult.error || !updateResult.data) {
      return NextResponse.json({ error: updateResult.error?.message ?? "更新預約狀態失敗。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }

    return NextResponse.json({ booking: updateResult.data, build_tag: BUDDIES_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "請先登入後再操作這筆預約。", build_tag: BUDDIES_BUILD_TAG }, { status: 401 });
    }
    return NextResponse.json({ error: error?.message || "Unexpected server error", build_tag: BUDDIES_BUILD_TAG }, { status: 500 });
  }
}
