import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireBuddiesRealNameVerifiedForRequest } from "@/lib/server/identityAccess";
import {
  holdBuddySettlement,
  requireBuddiesCommercialPilot,
} from "@/lib/server/buddySettlement";
import { P3_BUILD_TAGS } from "@/lib/p3Status";

export const runtime = "nodejs";
type Context = { params: Promise<{ bookingId: string }> };
type Body = { reason_category?: string; description?: string };

export async function POST(req: Request, context: Context) {
  try {
    const { userId } = await requireBuddiesRealNameVerifiedForRequest(req);
    requireBuddiesCommercialPilot(userId);
    const { bookingId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as Body;
    const description = String(body.description || "").trim().slice(0, 3000);
    const reasonCategory = String(body.reason_category || "other").trim().slice(0, 80);
    if (description.length < 10) {
      return NextResponse.json(
        { error: "請至少用 10 個字說明爭議情況。" },
        { status: 400 },
      );
    }

    const booking = await supabaseAdmin
      .from("buddy_bookings")
      .select("*")
      .eq("id", bookingId)
      .maybeSingle();
    if (booking.error || !booking.data) {
      return NextResponse.json(
        { error: booking.error?.message || "找不到預約。" },
        { status: 404 },
      );
    }
    const isBuyer = booking.data.buyer_user_id === userId;
    const isProvider = booking.data.provider_user_id === userId;
    if (!isBuyer && !isProvider) {
      return NextResponse.json(
        { error: "你沒有權限建立這筆爭議。" },
        { status: 403 },
      );
    }
    if (booking.data.payment_status !== "paid") {
      return NextResponse.json(
        { error: "未付款預約不需要開啟金流爭議，可直接取消。" },
        { status: 409 },
      );
    }

    const existing = await supabaseAdmin
      .from("buddy_disputes")
      .select("id,dispute_status")
      .eq("booking_id", bookingId)
      .in("dispute_status", ["open", "reviewing"])
      .limit(1)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) {
      return NextResponse.json(
        {
          error: "這筆預約已有處理中的爭議。",
          dispute: existing.data,
        },
        { status: 409 },
      );
    }

    const inserted = await supabaseAdmin
      .from("buddy_disputes")
      .insert({
        booking_id: bookingId,
        service_id: booking.data.service_id,
        opened_by_user_id: userId,
        counterparty_user_id: isBuyer
          ? booking.data.provider_user_id
          : booking.data.buyer_user_id,
        dispute_status: "open",
        reason_category: reasonCategory,
        description,
        metadata: {
          payment_order_id: booking.data.payment_order_id ?? null,
          settlement_id: booking.data.settlement_id ?? null,
          build_tag: P3_BUILD_TAGS.settlement,
        },
      })
      .select("*")
      .single();
    if (inserted.error || !inserted.data) {
      return NextResponse.json(
        { error: inserted.error?.message || "建立爭議失敗。" },
        { status: 400 },
      );
    }

    await holdBuddySettlement({
      bookingId,
      actorUserId: userId,
      reason: `dispute:${reasonCategory}`,
      disputeId: inserted.data.id,
    });

    await Promise.all([
      supabaseAdmin.from("buddy_booking_events").insert({
        booking_id: bookingId,
        actor_user_id: userId,
        event_type: "dispute_opened",
        metadata: { dispute_id: inserted.data.id, reason_category: reasonCategory },
      }),
      supabaseAdmin
        .from("buddy_bookings")
        .update({ dispute_status: "open", updated_at: new Date().toISOString() })
        .eq("id", bookingId),
      supabaseAdmin.from("support_tickets").insert({
        user_id: userId,
        category: "buddies",
        subject: `Buddies 預約爭議 ${bookingId.slice(0, 8)}`,
        description,
        status: "open",
        priority: "high",
        related_booking_id: bookingId,
        related_payment_order_id: booking.data.payment_order_id ?? null,
        metadata: {
          buddy_dispute_id: inserted.data.id,
          build_tag: P3_BUILD_TAGS.settlement,
        },
      }),
    ]);

    return NextResponse.json({
      dispute: inserted.data,
      payout_held: true,
      build_tag: P3_BUILD_TAGS.settlement,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || "建立爭議失敗。",
        build_tag: P3_BUILD_TAGS.settlement,
      },
      { status: Number(error?.status || 500) },
    );
  }
}
