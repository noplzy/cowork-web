import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { BUDDIES_BUILD_TAG } from "@/lib/buddies";
export const runtime = "nodejs";
type Context = { params: Promise<{ bookingId: string }> };
type Body = { rating?: number; comment?: string | null };

export async function POST(req: Request, context: Context) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { bookingId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as Body;
    const rating = Number(body.rating || 0);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: "評分需為 1～5 分。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    const booking = await supabaseAdmin.from("buddy_bookings").select("*").eq("id", bookingId).maybeSingle();
    if (booking.error || !booking.data) return NextResponse.json({ error: booking.error?.message || "找不到預約。", build_tag: BUDDIES_BUILD_TAG }, { status: 404 });
    if (booking.data.booking_status !== "completed") return NextResponse.json({ error: "只有已完成的預約可以評價。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    const isBuyer = booking.data.buyer_user_id === userId; const isProvider = booking.data.provider_user_id === userId;
    if (!isBuyer && !isProvider) return NextResponse.json({ error: "你沒有權限評價這筆預約。", build_tag: BUDDIES_BUILD_TAG }, { status: 403 });
    const reviewee = isBuyer ? booking.data.provider_user_id : booking.data.buyer_user_id;
    const result = await supabaseAdmin.from("buddy_reviews").upsert({ booking_id: bookingId, service_id: booking.data.service_id, reviewer_user_id: userId, reviewee_user_id: reviewee, rating, comment: String(body.comment || "").trim().slice(0, 1000) || null }, { onConflict: "booking_id,reviewer_user_id" }).select("*").single();
    if (result.error || !result.data) return NextResponse.json({ error: result.error?.message || "儲存評價失敗。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    await supabaseAdmin.from("buddy_booking_events").insert({ booking_id: bookingId, actor_user_id: userId, event_type: "review_submitted", metadata: { rating } });
    return NextResponse.json({ review: result.data, build_tag: BUDDIES_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "請先登入後再評價。", build_tag: BUDDIES_BUILD_TAG }, { status: 401 });
    return NextResponse.json({ error: error?.message || "儲存評價失敗。", build_tag: BUDDIES_BUILD_TAG }, { status: 500 });
  }
}
