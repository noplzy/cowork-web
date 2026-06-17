import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { BUDDIES_BUILD_TAG } from "@/lib/buddies";
export const runtime = "nodejs";
type Context = { params: Promise<{ bookingId: string }> };
export async function GET(req: Request, context: Context) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { bookingId } = await context.params;
    const booking = await supabaseAdmin.from("buddy_bookings").select("id,buyer_user_id,provider_user_id").eq("id", bookingId).maybeSingle();
    if (booking.error || !booking.data) return NextResponse.json({ error: booking.error?.message || "找不到預約。", build_tag: BUDDIES_BUILD_TAG }, { status: 404 });
    if (booking.data.buyer_user_id !== userId && booking.data.provider_user_id !== userId) return NextResponse.json({ error: "你沒有權限查看這筆預約紀錄。", build_tag: BUDDIES_BUILD_TAG }, { status: 403 });
    const events = await supabaseAdmin.from("buddy_booking_events").select("*").eq("booking_id", bookingId).order("created_at", { ascending: false }).limit(80);
    if (events.error) return NextResponse.json({ error: events.error.message, build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    return NextResponse.json({ events: events.data ?? [], build_tag: BUDDIES_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "請先登入後再查看預約紀錄。", build_tag: BUDDIES_BUILD_TAG }, { status: 401 });
    return NextResponse.json({ error: error?.message || "讀取預約紀錄失敗。", build_tag: BUDDIES_BUILD_TAG }, { status: 500 });
  }
}
