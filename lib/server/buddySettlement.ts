import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  P3_BUILD_TAGS,
  buddiesMaxBookingAmountTwd,
  buddiesPlatformFeeBps,
  buddiesPayoutHoldHours,
  isBuddiesCommercialPilotEnabled,
  isBuddiesRemoteOnlyPilot,
  isPilotUserAllowed,
} from "@/lib/p3Status";

export type BuddySettlementStatus =
  | "awaiting_payment"
  | "funds_held"
  | "service_accepted"
  | "completed_hold"
  | "releasable"
  | "dispute_hold"
  | "refund_pending"
  | "refunded"
  | "payout_processing"
  | "paid_out"
  | "manual_review";

export function requireBuddiesCommercialPilot(userId: string) {
  if (!isBuddiesCommercialPilotEnabled()) {
    throw Object.assign(new Error("BUDDIES_COMMERCIAL_PILOT_DISABLED"), {
      status: 503,
      code: "BUDDIES_COMMERCIAL_PILOT_DISABLED",
    });
  }
  if (!isPilotUserAllowed(userId)) {
    throw Object.assign(new Error("BUDDIES_PILOT_USER_NOT_ALLOWED"), {
      status: 403,
      code: "BUDDIES_PILOT_USER_NOT_ALLOWED",
    });
  }
}

export async function requireApprovedBuddyProvider(providerUserId: string) {
  const result = await supabaseAdmin
    .from("buddy_provider_applications")
    .select("id,application_status,reviewed_at")
    .eq("user_id", providerUserId)
    .eq("application_status", "approved")
    .order("reviewed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) {
    throw Object.assign(new Error("BUDDY_PROVIDER_NOT_APPROVED"), {
      status: 403,
      code: "BUDDY_PROVIDER_NOT_APPROVED",
    });
  }
  return result.data;
}

export async function getBuddyBookingForParty(
  bookingId: string,
  userId: string,
) {
  const result = await supabaseAdmin
    .from("buddy_bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) {
    throw Object.assign(new Error("BUDDY_BOOKING_NOT_FOUND"), { status: 404 });
  }
  if (
    result.data.buyer_user_id !== userId &&
    result.data.provider_user_id !== userId
  ) {
    throw Object.assign(new Error("BUDDY_BOOKING_FORBIDDEN"), { status: 403 });
  }
  return result.data as any;
}

export async function getBuddySettlementSnapshot(
  bookingId: string,
  userId: string,
) {
  const booking = await getBuddyBookingForParty(bookingId, userId);
  const [settlement, events, payment] = await Promise.all([
    supabaseAdmin
      .from("buddy_settlements")
      .select(
        "id,booking_id,buyer_user_id,provider_user_id,status,gross_amount_twd,platform_fee_twd,provider_net_twd,refund_amount_twd,available_for_payout_at,paid_out_at,hold_reason,created_at,updated_at",
      )
      .eq("booking_id", bookingId)
      .maybeSingle(),
    supabaseAdmin
      .from("buddy_settlement_events")
      .select("id,event_type,from_status,to_status,metadata,created_at")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("buddy_booking_payment_applications")
      .select("payment_order_id,status,applied_at,reversed_at")
      .eq("booking_id", bookingId)
      .maybeSingle(),
  ]);
  if (settlement.error) throw settlement.error;
  if (events.error) throw events.error;
  if (payment.error) throw payment.error;
  return {
    booking: {
      id: booking.id,
      service_id: booking.service_id,
      buyer_user_id: booking.buyer_user_id,
      provider_user_id: booking.provider_user_id,
      booking_status: booking.booking_status,
      payment_status: booking.payment_status,
      dispute_status: booking.dispute_status,
      total_amount_twd: booking.total_amount_twd,
      scheduled_start_at: booking.scheduled_start_at,
      scheduled_end_at: booking.scheduled_end_at,
      buyer_completed_at: booking.buyer_completed_at,
      provider_completed_at: booking.provider_completed_at,
      linked_room_id: booking.linked_room_id,
    },
    settlement: settlement.data ?? null,
    payment_application: payment.data ?? null,
    events: events.data ?? [],
    build_tag: P3_BUILD_TAGS.settlement,
  };
}

export async function applyBuddyPayment(input: {
  paymentOrderId: string;
  bookingId: string;
  buyerUserId: string;
  paidAt?: string | null;
  providerPayload?: Record<string, unknown>;
}) {
  const result = await supabaseAdmin.rpc("cowork_apply_buddy_payment_v3", {
    p_payment_order_id: input.paymentOrderId,
    p_booking_id: input.bookingId,
    p_buyer_user_id: input.buyerUserId,
    p_platform_fee_bps: buddiesPlatformFeeBps(),
    p_paid_at: input.paidAt ?? new Date().toISOString(),
    p_metadata: {
      ...(input.providerPayload ?? {}),
      build_tag: P3_BUILD_TAGS.notify,
    },
  });
  if (result.error) throw result.error;
  return result.data;
}

export async function confirmBuddyCompletion(
  bookingId: string,
  userId: string,
) {
  const result = await supabaseAdmin.rpc("cowork_confirm_buddy_completion_v3", {
    p_booking_id: bookingId,
    p_user_id: userId,
    p_hold_hours: buddiesPayoutHoldHours(),
  });
  if (result.error) throw result.error;
  return result.data;
}

export async function holdBuddySettlement(input: {
  bookingId: string;
  actorUserId?: string | null;
  reason: string;
  disputeId?: string | null;
}) {
  const result = await supabaseAdmin.rpc("cowork_hold_buddy_settlement_v3", {
    p_booking_id: input.bookingId,
    p_actor_user_id: input.actorUserId ?? null,
    p_reason: input.reason,
    p_dispute_id: input.disputeId ?? null,
  });
  if (result.error) throw result.error;
  return result.data;
}

export async function releaseBuddySettlement(input: {
  bookingId: string;
  adminUserId: string;
  reason: string;
}) {
  const result = await supabaseAdmin.rpc("cowork_release_buddy_settlement_v3", {
    p_booking_id: input.bookingId,
    p_admin_user_id: input.adminUserId,
    p_reason: input.reason,
  });
  if (result.error) throw result.error;
  return result.data;
}

export async function queueBuddyRefundIfPaid(input: {
  booking: any;
  requestedByUserId: string;
  reason: string;
}) {
  if (input.booking.payment_status !== "paid") return null;
  const paymentOrderId = input.booking.payment_order_id;
  if (!paymentOrderId) {
    throw new Error("Paid Buddy booking is missing payment_order_id");
  }

  const existing = await supabaseAdmin
    .from("refund_requests")
    .select("id,status")
    .eq("payment_order_id", paymentOrderId)
    .in("status", ["requested", "reviewing", "approved", "processing", "refunded"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const inserted = await supabaseAdmin
    .from("refund_requests")
    .insert({
      user_id: input.booking.buyer_user_id,
      payment_order_id: paymentOrderId,
      amount_twd: Number(input.booking.total_amount_twd || 0),
      reason_category: "service_issue",
      reason: input.reason,
      status: "requested",
      provider: "ecpay",
      metadata: {
        buddy_booking_id: input.booking.id,
        requested_by_user_id: input.requestedByUserId,
        build_tag: P3_BUILD_TAGS.settlement,
      },
    })
    .select("id,status")
    .single();
  if (inserted.error) throw inserted.error;

  await supabaseAdmin
    .from("buddy_settlements")
    .update({
      status: "refund_pending",
      hold_reason: input.reason,
      updated_at: new Date().toISOString(),
    })
    .eq("booking_id", input.booking.id)
    .not("status", "in", '("refunded","paid_out")');

  return inserted.data;
}

export async function assertCommercialBookingAmount(amount: number) {
  if (!Number.isFinite(amount) || amount < 100) {
    throw Object.assign(new Error("BUDDY_BOOKING_AMOUNT_INVALID"), {
      status: 400,
    });
  }
  if (amount > buddiesMaxBookingAmountTwd()) {
    throw Object.assign(new Error("BUDDY_BOOKING_AMOUNT_OVER_PILOT_LIMIT"), {
      status: 400,
    });
  }
}

export function assertPilotDeliveryMode(deliveryMode: string) {
  if (isBuddiesRemoteOnlyPilot() && deliveryMode !== "remote") {
    throw Object.assign(new Error("BUDDIES_TRIAL_REMOTE_ONLY"), {
      status: 400,
      code: "BUDDIES_TRIAL_REMOTE_ONLY",
    });
  }
}
