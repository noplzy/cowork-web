import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { BUDDIES_BUILD_TAG, type BuddyBookingRow } from "@/lib/buddies";

export const runtime = "nodejs";

type BookingActionBody = {
  action?: "accept" | "decline" | "cancel" | "complete";
  provider_note?: string | null;
};

export async function PATCH(
  req: Request,
  context: { params: Promise<{ bookingId: string }> | { bookingId: string } },
) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const params = await context.params;
    const bookingId = (params.bookingId ?? "").trim();
    const body = (await req.json()) as BookingActionBody;
    const action = body.action;
    const providerNote = (body.provider_note ?? "").trim().slice(0, 800) || null;

    if (!bookingId) {
      return NextResponse.json({ error: "缺少 bookingId。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }
    if (!action) {
      return NextResponse.json({ error: "缺少預約動作。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }

    const currentResult = await supabaseAdmin
      .from("buddy_bookings")
      .select("*")
      .eq("id", bookingId)
      .maybeSingle();

    const booking = currentResult.data as BuddyBookingRow | null;
    if (currentResult.error || !booking) {
      return NextResponse.json({ error: currentResult.error?.message ?? "找不到這筆預約。", build_tag: BUDDIES_BUILD_TAG }, { status: 404 });
    }

    const isBuyer = booking.buyer_user_id === userId;
    const isProvider = booking.provider_user_id === userId;
    if (!isBuyer && !isProvider) {
      return NextResponse.json({ error: "你沒有權限修改這筆預約。", build_tag: BUDDIES_BUILD_TAG }, { status: 403 });
    }

    let nextStatus = booking.booking_status;

    if (action === "accept") {
      if (!isProvider || booking.booking_status !== "pending") {
        return NextResponse.json({ error: "只有服務提供者可以接受待回覆預約。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
      }
      nextStatus = "accepted";
    } else if (action === "decline") {
      if (!isProvider || booking.booking_status !== "pending") {
        return NextResponse.json({ error: "只有服務提供者可以婉拒待回覆預約。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
      }
      nextStatus = "declined";
    } else if (action === "cancel") {
      if (!["pending", "accepted"].includes(booking.booking_status)) {
        return NextResponse.json({ error: "這筆預約目前不能取消。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
      }
      nextStatus = "cancelled";
    } else if (action === "complete") {
      if (!isProvider || booking.booking_status !== "accepted") {
        return NextResponse.json({ error: "只有服務提供者可以把已接受預約標記完成。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
      }
      nextStatus = "completed";
    } else {
      return NextResponse.json({ error: "不支援的預約動作。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {
      booking_status: nextStatus,
    };
    if (providerNote !== null && isProvider) {
      updatePayload.provider_note = providerNote;
    }

    const updateResult = await supabaseAdmin
      .from("buddy_bookings")
      .update(updatePayload)
      .eq("id", booking.id)
      .select("*")
      .single();

    if (updateResult.error || !updateResult.data) {
      return NextResponse.json(
        { error: updateResult.error?.message ?? "更新安感夥伴預約失敗。", build_tag: BUDDIES_BUILD_TAG },
        { status: 400 },
      );
    }

    return NextResponse.json({
      booking: updateResult.data,
      build_tag: BUDDIES_BUILD_TAG,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "請先登入後再操作安感夥伴預約。", build_tag: BUDDIES_BUILD_TAG },
        { status: 401 },
      );
    }
    return NextResponse.json({ error: error?.message || "Unexpected server error", build_tag: BUDDIES_BUILD_TAG }, { status: 500 });
  }
}
