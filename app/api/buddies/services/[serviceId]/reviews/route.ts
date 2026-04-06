import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { BUDDIES_BUILD_TAG, type BuddyBookingRow } from "@/lib/buddies";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ serviceId: string }> };
type ReviewPayload = { booking_id?: string; rating?: number; comment?: string | null };

export async function POST(req: Request, context: RouteContext) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { serviceId } = await context.params;
    const body = (await req.json()) as ReviewPayload;
    const bookingId = (body.booking_id ?? "").trim();
    const rating = Number(body.rating ?? 0);
    const comment = (body.comment ?? "").trim().slice(0, 600) || null;

    if (!bookingId) {
      return NextResponse.json({ error: "請先指定 booking。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "評分必須是 1～5。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }

    const bookingResult = await supabaseAdmin.from("buddy_bookings").select("*").eq("id", bookingId).maybeSingle();
    const booking = bookingResult.data as BuddyBookingRow | null;

    if (bookingResult.error || !booking) {
      return NextResponse.json({ error: bookingResult.error?.message ?? "找不到 booking。", build_tag: BUDDIES_BUILD_TAG }, { status: 404 });
    }
    if (booking.service_id !== serviceId) {
      return NextResponse.json({ error: "booking 與服務不一致。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }
    if (booking.booking_status !== "completed") {
      return NextResponse.json({ error: "只有已完成的預約才能評價。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }
    if (booking.buyer_user_id !== userId && booking.provider_user_id !== userId) {
      return NextResponse.json({ error: "你沒有權限評價這筆預約。", build_tag: BUDDIES_BUILD_TAG }, { status: 403 });
    }

    const revieweeUserId = booking.buyer_user_id === userId ? booking.provider_user_id : booking.buyer_user_id;
    const insertResult = await supabaseAdmin
      .from("buddy_reviews")
      .insert({
        booking_id: booking.id,
        service_id: serviceId,
        reviewer_user_id: userId,
        reviewee_user_id: revieweeUserId,
        rating,
        comment,
      })
      .select("*")
      .single();

    if (insertResult.error || !insertResult.data) {
      return NextResponse.json({ error: insertResult.error?.message ?? "寫入評價失敗。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }

    return NextResponse.json({ review: insertResult.data, build_tag: BUDDIES_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "請先登入後再留下評價。", build_tag: BUDDIES_BUILD_TAG }, { status: 401 });
    }
    return NextResponse.json({ error: error?.message || "Unexpected server error", build_tag: BUDDIES_BUILD_TAG }, { status: 500 });
  }
}
