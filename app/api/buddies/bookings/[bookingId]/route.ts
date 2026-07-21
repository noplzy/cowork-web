import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { BUDDIES_BUILD_TAG, type BuddyBookingRow } from "@/lib/buddies";
import {
  identityAccessErrorResponse,
  requireBuddiesRealNameVerifiedForRequest,
} from "@/lib/server/identityAccess";
import {
  confirmBuddyCompletion,
  queueBuddyRefundIfPaid,
  requireApprovedBuddyProvider,
  requireBuddiesCommercialPilot,
} from "@/lib/server/buddySettlement";
import { P3_BUILD_TAGS } from "@/lib/p3Status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ bookingId: string }> };
type PatchBody = {
  action?: "accept" | "decline" | "cancel" | "complete";
  provider_note?: string | null;
};

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { userId } = await requireBuddiesRealNameVerifiedForRequest(req);
    requireBuddiesCommercialPilot(userId);
    const { bookingId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as PatchBody;
    const action = body.action;
    const providerNote = String(body.provider_note || "").trim().slice(0, 800) || null;
    if (!action || !["accept", "decline", "cancel", "complete"].includes(action)) {
      return NextResponse.json({ error: "無效的預約動作。" }, { status: 400 });
    }

    const bookingResult = await supabaseAdmin
      .from("buddy_bookings")
      .select("*")
      .eq("id", bookingId)
      .maybeSingle();
    if (bookingResult.error || !bookingResult.data) {
      return NextResponse.json(
        { error: bookingResult.error?.message || "找不到這筆預約。" },
        { status: 404 },
      );
    }
    const booking = bookingResult.data as BuddyBookingRow & {
      payment_order_id?: string | null;
      room_provision_status?: string | null;
    };
    const isBuyer = booking.buyer_user_id === userId;
    const isProvider = booking.provider_user_id === userId;
    if (!isBuyer && !isProvider) {
      return NextResponse.json({ error: "你沒有權限操作這筆預約。" }, { status: 403 });
    }

    if (action === "complete") {
      if (!["accepted", "completed"].includes(booking.booking_status)) {
        return NextResponse.json({ error: "只有已接受的預約可以確認完成。" }, { status: 409 });
      }
      const result = await confirmBuddyCompletion(booking.id, userId);
      return NextResponse.json({ completion: result, build_tag: P3_BUILD_TAGS.settlement });
    }

    if ((action === "accept" || action === "decline") && !isProvider) {
      return NextResponse.json({ error: "只有服務提供者可以接受或婉拒。" }, { status: 403 });
    }
    if (action === "accept") {
      if (booking.booking_status !== "pending") {
        return NextResponse.json({ error: "只有待回覆的預約可以接受。" }, { status: 409 });
      }
      if (booking.payment_status !== "paid") {
        return NextResponse.json(
          { error: "這筆預約尚未完成付款。", code: "BUDDY_BOOKING_UNPAID" },
          { status: 402 },
        );
      }
      await requireApprovedBuddyProvider(booking.provider_user_id);
    }
    if (action === "decline" && booking.booking_status !== "pending") {
      return NextResponse.json({ error: "只有待回覆的預約可以婉拒。" }, { status: 409 });
    }
    if (action === "cancel" && !["pending", "accepted"].includes(booking.booking_status)) {
      return NextResponse.json({ error: "目前狀態不能取消。" }, { status: 409 });
    }
    if (
      action === "cancel" &&
      booking.booking_status === "accepted" &&
      new Date(booking.scheduled_start_at).getTime() <= Date.now()
    ) {
      return NextResponse.json(
        {
          error: "服務開始後不能直接自助取消，請改由爭議流程處理。",
          code: "BUDDY_CANCELLATION_REQUIRES_DISPUTE",
          build_tag: P3_BUILD_TAGS.buddiesCommercial,
        },
        { status: 409 },
      );
    }

    const refund =
      action === "decline" || action === "cancel"
        ? await queueBuddyRefundIfPaid({
            booking,
            requestedByUserId: userId,
            reason:
              action === "decline"
                ? "服務提供者婉拒已付款預約"
                : "預約取消，進入全額退款流程",
          })
        : null;

    const transitioned = await supabaseAdmin.rpc("cowork_transition_buddy_booking_v3", {
      p_booking_id: booking.id,
      p_actor_user_id: userId,
      p_action: action,
      p_note: providerNote,
      p_linked_room_id: null,
      p_linked_room_invite_code: null,
    });
    if (transitioned.error) throw transitioned.error;

    if (action === "cancel" && booking.linked_room_id) {
      await supabaseAdmin
        .from("rooms")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
          cleanup_reason: "buddy_booking_cancelled_p3",
        })
        .eq("id", booking.linked_room_id)
        .eq("status", "active");
    }

    return NextResponse.json({
      booking: transitioned.data,
      refund_request: refund,
      room_provisioning:
        action === "accept"
          ? "lazy_within_15_minutes_of_scheduled_start"
          : booking.room_provision_status || null,
      build_tag: P3_BUILD_TAGS.buddiesCommercial,
      legacy_build_tag: BUDDIES_BUILD_TAG,
    });
  } catch (error: any) {
    const mapped = identityAccessErrorResponse(error, P3_BUILD_TAGS.buddiesCommercial);
    if (mapped) return mapped;
    return NextResponse.json(
      {
        error: error?.message || "更新預約狀態失敗。",
        code: error?.code,
        build_tag: P3_BUILD_TAGS.buddiesCommercial,
      },
      {
        status:
          Number(error?.status) ||
          (/BUDDY_CANCELLATION_REQUIRES_DISPUTE|BUDDY_COMPLETION_TOO_EARLY/.test(
            String(error?.message || ""),
          )
            ? 409
            : 500),
      },
    );
  }
}
