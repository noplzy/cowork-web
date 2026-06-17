import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { BUDDIES_BUILD_TAG } from "@/lib/buddies";
export const runtime = "nodejs";
type Context = { params: Promise<{ bookingId: string }> };
type Body = { reason_category?: string; description?: string };

export async function POST(req: Request, context: Context) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { bookingId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as Body;
    const description = String(body.description || "").trim().slice(0, 3000);
    if (!description) return NextResponse.json({ error: "請填寫爭議說明。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    const booking = await supabaseAdmin.from("buddy_bookings").select("*").eq("id", bookingId).maybeSingle();
    if (booking.error || !booking.data) return NextResponse.json({ error: booking.error?.message || "找不到預約。", build_tag: BUDDIES_BUILD_TAG }, { status: 404 });
    const isBuyer = booking.data.buyer_user_id === userId; const isProvider = booking.data.provider_user_id === userId;
    if (!isBuyer && !isProvider) return NextResponse.json({ error: "你沒有權限建立這筆爭議。", build_tag: BUDDIES_BUILD_TAG }, { status: 403 });
    const existing = await supabaseAdmin.from("buddy_disputes").select("id").eq("booking_id", bookingId).in("dispute_status", ["open", "reviewing"]).limit(1);
    if (existing.error) return NextResponse.json({ error: existing.error.message, build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    if ((existing.data ?? []).length > 0) return NextResponse.json({ error: "這筆預約已有處理中的爭議。", build_tag: BUDDIES_BUILD_TAG }, { status: 409 });
    const inserted = await supabaseAdmin.from("buddy_disputes").insert({ booking_id: bookingId, service_id: booking.data.service_id, opened_by_user_id: userId, counterparty_user_id: isBuyer ? booking.data.provider_user_id : booking.data.buyer_user_id, dispute_status: "open", reason_category: String(body.reason_category || "other").slice(0, 80), description }).select("*").single();
    if (inserted.error || !inserted.data) return NextResponse.json({ error: inserted.error?.message || "建立爭議失敗。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    await supabaseAdmin.from("buddy_booking_events").insert({ booking_id: bookingId, actor_user_id: userId, event_type: "dispute_opened", metadata: { dispute_id: inserted.data.id } });
    await supabaseAdmin.from("buddy_bookings").update({ dispute_status: "open", updated_at: new Date().toISOString() }).eq("id", bookingId);
    return NextResponse.json({ dispute: inserted.data, build_tag: BUDDIES_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "請先登入後再建立爭議。", build_tag: BUDDIES_BUILD_TAG }, { status: 401 });
    return NextResponse.json({ error: error?.message || "建立爭議失敗。", build_tag: BUDDIES_BUILD_TAG }, { status: 500 });
  }
}
