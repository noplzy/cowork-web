import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  BuddyWorkspaceActionKey,
  BuddyWorkspaceActionState,
  BuddyWorkspaceBooking,
  BuddyWorkspaceProfile,
  BuddyWorkspaceService,
  BuddyWorkspaceSnapshot,
} from "@/lib/buddyWorkspaceTypes";
import { P3_BUILD_TAGS } from "@/lib/p3Status";
import { P4B_BUILD_TAGS } from "@/lib/p4bStatus";

// supabaseAdmin uses the server-only service_role client and therefore bypasses RLS.
// This read model must only be called after the route has authenticated and real-name
// gated the requesting user; every root query below is scoped to that user.
const ROOM_EARLY_MINUTES = 15;
const ROOM_LATE_MINUTES = 15;
const TERMINAL_SETTLEMENTS = new Set(["refunded", "paid_out"]);
const ATTENTION_SETTLEMENTS = new Set([
  "dispute_hold",
  "refund_pending",
  "manual_review",
]);

function asText(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function asNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function asIso(value: unknown): string | null {
  const text = asText(value);
  if (!text) return null;
  const time = new Date(text).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function indexBy<T>(rows: T[], key: (row: T) => string) {
  return Object.fromEntries(rows.map((row) => [key(row), row])) as Record<string, T>;
}

function action(enabled: boolean, reason: string | null = null): BuddyWorkspaceActionState {
  return { enabled, reason: enabled ? null : reason };
}

function profileProjection(row: any | null): BuddyWorkspaceProfile | null {
  if (!row?.user_id) return null;
  return {
    user_id: String(row.user_id),
    handle: asText(row.handle) || null,
    display_name: asText(row.display_name, "安感島使用者"),
    avatar_url: asText(row.avatar_url) || null,
    is_professional_buddy: row.is_professional_buddy === true,
  };
}

function serviceProjection(row: any | null) {
  if (!row?.id) return null;
  return {
    id: String(row.id),
    title: asText(row.title, "安感夥伴服務"),
    summary: asText(row.summary, "低壓力、可預約的陪伴服務。"),
    buddy_category: asText(row.buddy_category, "focus"),
    interaction_style: asText(row.interaction_style, "guided"),
    delivery_mode: asText(row.delivery_mode, "remote"),
    price_per_hour_twd: asNumber(row.price_per_hour_twd),
  };
}

function nextStep(input: {
  viewerRole: "buyer" | "provider";
  booking: any;
  settlement: any | null;
  dispute: any | null;
  nowMs: number;
}) {
  const { viewerRole, booking, settlement, dispute, nowMs } = input;
  const startMs = new Date(booking.scheduled_start_at).getTime();
  const endMs = new Date(booking.scheduled_end_at).getTime();
  const settlementStatus = asText(settlement?.status);
  const bookingStatus = asText(booking.booking_status);
  const paymentStatus = asText(booking.payment_status);
  const viewerCompleted =
    viewerRole === "buyer"
      ? Boolean(booking.buyer_completed_at)
      : Boolean(booking.provider_completed_at);
  const counterpartyCompleted =
    viewerRole === "buyer"
      ? Boolean(booking.provider_completed_at)
      : Boolean(booking.buyer_completed_at);
  const roomWindowOpen =
    nowMs >= startMs - ROOM_EARLY_MINUTES * 60_000 &&
    nowMs <= endMs + ROOM_LATE_MINUTES * 60_000;

  if (dispute && ["open", "reviewing"].includes(asText(dispute.dispute_status))) {
    return {
      code: "dispute_in_review",
      label: "爭議處理中",
      detail: "客服已接手，相關撥款會保持暫停，請留意客服紀錄。",
      tone: "attention" as const,
    };
  }
  if (paymentStatus === "refunded" || settlementStatus === "refunded") {
    return {
      code: "refunded",
      label: "退款已完成",
      detail: "這筆預約已結束，不需要再進行履約或完成確認。",
      tone: "done" as const,
    };
  }
  if (bookingStatus === "cancelled" || bookingStatus === "declined") {
    return {
      code: "booking_closed",
      label: bookingStatus === "declined" ? "預約已婉拒" : "預約已取消",
      detail: paymentStatus === "paid" ? "退款流程會依後台紀錄繼續處理。" : "這筆預約已關閉。",
      tone: "done" as const,
    };
  }
  if (paymentStatus === "unpaid" && viewerRole === "buyer") {
    return {
      code: "payment_required",
      label: "下一步：完成付款",
      detail: "付款完成後，提供者才能接受預約並建立履約房。",
      tone: "attention" as const,
    };
  }
  if (paymentStatus === "unpaid" && viewerRole === "provider") {
    return {
      code: "waiting_payment",
      label: "等待對方付款",
      detail: "付款完成前不能接受，也不會建立履約房。",
      tone: "neutral" as const,
    };
  }
  if (bookingStatus === "pending" && viewerRole === "provider") {
    return {
      code: "provider_reply_required",
      label: "下一步：接受或婉拒",
      detail: "請先確認時段、服務內容與對方留言，再決定是否接受。",
      tone: "attention" as const,
    };
  }
  if (bookingStatus === "pending" && viewerRole === "buyer") {
    return {
      code: "waiting_provider",
      label: "等待提供者回覆",
      detail: "對方接受後，履約房會在開始前 15 分鐘開放建立。",
      tone: "neutral" as const,
    };
  }
  if (bookingStatus === "accepted" && roomWindowOpen) {
    return {
      code: "room_window_open",
      label: "履約房可以進入",
      detail: "任一方都可以建立或進入私人履約房。",
      tone: "ready" as const,
    };
  }
  if (bookingStatus === "accepted" && nowMs < startMs - ROOM_EARLY_MINUTES * 60_000) {
    return {
      code: "scheduled",
      label: "預約已成立",
      detail: "履約房會在開始前 15 分鐘開放。",
      tone: "ready" as const,
    };
  }
  if (["accepted", "completed"].includes(bookingStatus) && nowMs >= endMs) {
    if (!viewerCompleted) {
      return {
        code: "viewer_completion_required",
        label: "下一步：確認已完成",
        detail: "只有雙方都確認後，款項才會進入撥款保留期。",
        tone: "attention" as const,
      };
    }
    if (!counterpartyCompleted) {
      return {
        code: "waiting_counterparty_completion",
        label: "等待另一方確認完成",
        detail: "你已完成確認，另一方確認前不會進入可撥款狀態。",
        tone: "neutral" as const,
      };
    }
  }
  if (settlementStatus === "completed_hold") {
    return {
      code: "completion_hold",
      label: "完成後保留期",
      detail: settlement?.available_for_payout_at
        ? `預計 ${new Date(settlement.available_for_payout_at).toLocaleString("zh-TW")} 後可進入撥款。`
        : "正在等待保留期結束。",
      tone: "neutral" as const,
    };
  }
  if (settlementStatus === "releasable") {
    return {
      code: "payout_releasable",
      label: "可撥款",
      detail: "提供者可在收益頁確認收款帳戶狀態；實際轉帳仍由人工核對。",
      tone: "ready" as const,
    };
  }
  if (settlementStatus === "payout_processing") {
    return {
      code: "payout_processing",
      label: "撥款處理中",
      detail: "平台正在依人工撥款 SOP 處理。",
      tone: "neutral" as const,
    };
  }
  if (settlementStatus === "paid_out") {
    return {
      code: "paid_out",
      label: "已撥款",
      detail: "這筆結算已完成。",
      tone: "done" as const,
    };
  }
  if (ATTENTION_SETTLEMENTS.has(settlementStatus)) {
    return {
      code: settlementStatus || "attention",
      label: "需要人工處理",
      detail: "請查看客服、爭議或退款紀錄。",
      tone: "attention" as const,
    };
  }

  return {
    code: "monitor",
    label: "狀態已同步",
    detail: "目前沒有需要立即處理的動作。",
    tone: "neutral" as const,
  };
}

function buildActions(input: {
  viewerRole: "buyer" | "provider";
  booking: any;
  settlement: any | null;
  dispute: any | null;
  nowMs: number;
}): Record<BuddyWorkspaceActionKey, BuddyWorkspaceActionState> {
  const { viewerRole, booking, settlement, dispute, nowMs } = input;
  const startMs = new Date(booking.scheduled_start_at).getTime();
  const endMs = new Date(booking.scheduled_end_at).getTime();
  const bookingStatus = asText(booking.booking_status);
  const paymentStatus = asText(booking.payment_status);
  const settlementStatus = asText(settlement?.status);
  const openDispute =
    dispute && ["open", "reviewing"].includes(asText(dispute.dispute_status));
  const beforeStart = nowMs < startMs;
  const roomWindowOpen =
    nowMs >= startMs - ROOM_EARLY_MINUTES * 60_000 &&
    nowMs <= endMs + ROOM_LATE_MINUTES * 60_000;
  const viewerCompleted =
    viewerRole === "buyer"
      ? Boolean(booking.buyer_completed_at)
      : Boolean(booking.provider_completed_at);
  const terminalSettlement = TERMINAL_SETTLEMENTS.has(settlementStatus);

  return {
    pay: action(
      viewerRole === "buyer" && bookingStatus === "pending" && paymentStatus === "unpaid",
      "只有待付款的預約者可以付款。",
    ),
    accept: action(
      viewerRole === "provider" && bookingStatus === "pending" && paymentStatus === "paid",
      paymentStatus !== "paid" ? "對方尚未完成付款。" : "只有待回覆預約可以接受。",
    ),
    decline: action(
      viewerRole === "provider" && bookingStatus === "pending",
      "只有待回覆預約可以婉拒。",
    ),
    cancel: action(
      ["pending", "accepted"].includes(bookingStatus) && beforeStart && !openDispute,
      !beforeStart ? "服務開始後請改走爭議流程。" : "目前狀態不能取消。",
    ),
    room: action(
      bookingStatus === "accepted" && paymentStatus === "paid" && roomWindowOpen && !openDispute,
      !roomWindowOpen
        ? "履約房只在開始前 15 分鐘至結束後 15 分鐘內開放。"
        : "目前狀態不能進入履約房。",
    ),
    complete: action(
      ["accepted", "completed"].includes(bookingStatus) &&
        paymentStatus === "paid" &&
        nowMs >= endMs &&
        !viewerCompleted &&
        !openDispute,
      nowMs < endMs ? "服務結束後才能確認完成。" : "你已確認，或目前有爭議處理中。",
    ),
    dispute: action(
      paymentStatus === "paid" && !terminalSettlement && !openDispute,
      openDispute ? "已有處理中的爭議。" : "未付款、已退款或已撥款的預約不能再建立爭議。",
    ),
  };
}

function serviceWorkspaceProjection(service: any, slots: any[]): BuddyWorkspaceService {
  const ownSlots = slots
    .filter((slot) => String(slot.service_id) === String(service.id))
    .sort(
      (left, right) =>
        new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(),
    );
  const openSlots = ownSlots.filter((slot) => slot.slot_status === "open");
  return {
    id: String(service.id),
    title: asText(service.title, "安感夥伴服務"),
    summary: asText(service.summary, "尚未填寫摘要"),
    status: asText(service.status, "draft"),
    buddy_category: asText(service.buddy_category, "focus"),
    delivery_mode: asText(service.delivery_mode, "remote"),
    price_per_hour_twd: asNumber(service.price_per_hour_twd),
    accepts_new_users: service.accepts_new_users !== false,
    availability_note: asText(service.availability_note) || null,
    open_slots_count: openSlots.length,
    next_slot_at: openSlots.length ? asIso(openSlots[0]?.starts_at) : null,
  };
}

function sumSettlement(rows: any[], statuses: string[]) {
  return rows
    .filter((row) => statuses.includes(asText(row.status)))
    .reduce((total, row) => total + asNumber(row.provider_net_twd), 0);
}

export async function getBuddyOperationalWorkspace(
  userId: string,
): Promise<BuddyWorkspaceSnapshot> {
  const now = new Date();
  const nowIso = now.toISOString();
  const nowMs = now.getTime();

  const [
    bookingResult,
    ownServicesResult,
    ownSlotsResult,
    ownSettlementsResult,
    payoutAccountResult,
    payoutItemsResult,
  ] = await Promise.all([
      supabaseAdmin
        .from("buddy_bookings")
        .select("*")
        .or(`buyer_user_id.eq.${userId},provider_user_id.eq.${userId}`)
        .order("scheduled_start_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("buddy_services")
        .select(
          "id,provider_user_id,title,summary,buddy_category,interaction_style,delivery_mode,visibility,price_per_hour_twd,status,accepts_new_users,availability_note,updated_at",
        )
        .eq("provider_user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("buddy_service_slots")
        .select("id,service_id,provider_user_id,starts_at,ends_at,slot_status,note,updated_at")
        .eq("provider_user_id", userId)
        .gte("ends_at", new Date(nowMs - 24 * 60 * 60 * 1000).toISOString())
        .order("starts_at", { ascending: true })
        .limit(300),
      supabaseAdmin
        .from("buddy_settlements")
        .select(
          "id,booking_id,buyer_user_id,provider_user_id,status,gross_amount_twd,platform_fee_twd,provider_net_twd,refund_amount_twd,available_for_payout_at,paid_out_at,hold_reason,created_at,updated_at",
        )
        .eq("provider_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("buddy_payout_accounts")
        .select("*")
        .eq("provider_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("buddy_payout_items")
        .select(
          "id,batch_id,settlement_id,amount_twd,status,provider_reference,processed_at,created_at,updated_at",
        )
        .eq("provider_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  if (bookingResult.error) throw bookingResult.error;
  if (ownServicesResult.error) throw ownServicesResult.error;
  if (ownSlotsResult.error) throw ownSlotsResult.error;
  if (ownSettlementsResult.error) throw ownSettlementsResult.error;
  if (payoutAccountResult.error) throw payoutAccountResult.error;
  if (payoutItemsResult.error) throw payoutItemsResult.error;

  const bookings = (bookingResult.data ?? []) as any[];
  const bookingIds = bookings.map((row) => String(row.id));
  const serviceIds = Array.from(new Set(bookings.map((row) => String(row.service_id))));
  const profileIds = Array.from(
    new Set(
      bookings.flatMap((row) => [String(row.buyer_user_id), String(row.provider_user_id)]),
    ),
  );
  const roomIds = Array.from(
    new Set(bookings.map((row) => asText(row.linked_room_id)).filter(Boolean)),
  );

  const [servicesResult, profilesResult, settlementsResult, disputesResult, eventsResult, roomsResult] =
    await Promise.all([
      serviceIds.length
        ? supabaseAdmin
            .from("buddy_services")
            .select(
              "id,title,summary,buddy_category,interaction_style,delivery_mode,price_per_hour_twd",
            )
            .in("id", serviceIds)
        : Promise.resolve({ data: [], error: null } as any),
      profileIds.length
        ? supabaseAdmin
            .from("profiles")
            .select(
              "user_id,handle,display_name,avatar_url,is_professional_buddy",
            )
            .in("user_id", profileIds)
        : Promise.resolve({ data: [], error: null } as any),
      bookingIds.length
        ? supabaseAdmin
            .from("buddy_settlements")
            .select(
              "id,booking_id,buyer_user_id,provider_user_id,status,gross_amount_twd,platform_fee_twd,provider_net_twd,refund_amount_twd,available_for_payout_at,paid_out_at,hold_reason,created_at,updated_at",
            )
            .in("booking_id", bookingIds)
        : Promise.resolve({ data: [], error: null } as any),
      bookingIds.length
        ? supabaseAdmin
            .from("buddy_disputes")
            .select(
              "id,booking_id,dispute_status,reason_category,opened_by_user_id,created_at,updated_at",
            )
            .in("booking_id", bookingIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null } as any),
      bookingIds.length
        ? supabaseAdmin
            .from("buddy_settlement_events")
            .select(
              "id,booking_id,event_type,from_status,to_status,actor_role,created_at",
            )
            .in("booking_id", bookingIds)
            .order("created_at", { ascending: false })
            .limit(600)
        : Promise.resolve({ data: [], error: null } as any),
      roomIds.length
        ? supabaseAdmin
            .from("rooms")
            .select("id,status,scheduled_end_at,ended_at")
            .in("id", roomIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

  for (const result of [
    servicesResult,
    profilesResult,
    settlementsResult,
    disputesResult,
    eventsResult,
    roomsResult,
  ]) {
    if (result.error) throw result.error;
  }

  const servicesById = indexBy((servicesResult.data ?? []) as any[], (row) => String(row.id));
  const profilesById = indexBy((profilesResult.data ?? []) as any[], (row) => String(row.user_id));
  const settlementsByBooking = indexBy(
    (settlementsResult.data ?? []) as any[],
    (row) => String(row.booking_id),
  );
  const roomsById = indexBy((roomsResult.data ?? []) as any[], (row) => String(row.id));
  const disputesByBooking: Record<string, any> = {};
  for (const row of (disputesResult.data ?? []) as any[]) {
    const bookingId = String(row.booking_id);
    if (!disputesByBooking[bookingId]) disputesByBooking[bookingId] = row;
  }
  const eventsByBooking: Record<string, any[]> = {};
  for (const row of (eventsResult.data ?? []) as any[]) {
    const bookingId = String(row.booking_id);
    eventsByBooking[bookingId] ||= [];
    if (eventsByBooking[bookingId].length < 6) eventsByBooking[bookingId].push(row);
  }

  const projectedBookings: BuddyWorkspaceBooking[] = bookings.map((booking) => {
    const viewerRole =
      String(booking.buyer_user_id) === userId ? "buyer" : "provider";
    const counterpartUserId =
      viewerRole === "buyer"
        ? String(booking.provider_user_id)
        : String(booking.buyer_user_id);
    const settlement = settlementsByBooking[String(booking.id)] ?? null;
    const dispute = disputesByBooking[String(booking.id)] ?? null;
    const room = booking.linked_room_id
      ? roomsById[String(booking.linked_room_id)] ?? null
      : null;

    return {
      id: String(booking.id),
      viewer_role: viewerRole,
      booking_status: asText(booking.booking_status, "pending"),
      payment_status: asText(booking.payment_status, "unpaid"),
      scheduled_start_at: asIso(booking.scheduled_start_at) || nowIso,
      scheduled_end_at: asIso(booking.scheduled_end_at) || nowIso,
      total_amount_twd: asNumber(booking.total_amount_twd),
      buyer_note: asText(booking.buyer_note) || null,
      provider_note: asText(booking.provider_note) || null,
      linked_room_id: asText(booking.linked_room_id) || null,
      room_provision_status: asText(booking.room_provision_status) || null,
      buyer_completed_at: asIso(booking.buyer_completed_at),
      provider_completed_at: asIso(booking.provider_completed_at),
      dispute_status: asText(booking.dispute_status) || null,
      service: serviceProjection(servicesById[String(booking.service_id)] ?? null),
      counterpart: profileProjection(profilesById[counterpartUserId] ?? null),
      settlement: settlement
        ? {
            id: String(settlement.id),
            status: asText(settlement.status),
            gross_amount_twd: asNumber(settlement.gross_amount_twd),
            platform_fee_twd: asNumber(settlement.platform_fee_twd),
            provider_net_twd: asNumber(settlement.provider_net_twd),
            refund_amount_twd: asNumber(settlement.refund_amount_twd),
            available_for_payout_at: asIso(settlement.available_for_payout_at),
            paid_out_at: asIso(settlement.paid_out_at),
            hold_reason: asText(settlement.hold_reason) || null,
          }
        : null,
      dispute: dispute
        ? {
            id: String(dispute.id),
            dispute_status: asText(dispute.dispute_status),
            reason_category: asText(dispute.reason_category, "other"),
            created_at: asIso(dispute.created_at) || nowIso,
          }
        : null,
      room: room
        ? {
            id: String(room.id),
            status: asText(room.status) || null,
            scheduled_end_at: asIso(room.scheduled_end_at),
            ended_at: asIso(room.ended_at),
          }
        : null,
      recent_events: (eventsByBooking[String(booking.id)] ?? []).map((event) => ({
        id: String(event.id),
        event_type: asText(event.event_type),
        from_status: asText(event.from_status) || null,
        to_status: asText(event.to_status) || null,
        actor_role: asText(event.actor_role, "system"),
        created_at: asIso(event.created_at) || nowIso,
      })),
      next_step: nextStep({ viewerRole, booking, settlement, dispute, nowMs }),
      actions: buildActions({ viewerRole, booking, settlement, dispute, nowMs }),
    };
  });

  const buyerBookings = projectedBookings.filter((row) => row.viewer_role === "buyer");
  const providerBookings = projectedBookings.filter(
    (row) => row.viewer_role === "provider",
  );
  const providerSettlements = (ownSettlementsResult.data ?? []) as any[];
  const ownServices = (ownServicesResult.data ?? []) as any[];
  const ownSlots = (ownSlotsResult.data ?? []) as any[];
  const serviceRows = ownServices.map((service) =>
    serviceWorkspaceProjection(service, ownSlots),
  );

  const payoutAccount = payoutAccountResult.data as any | null;

  return {
    generated_at: nowIso,
    server_now: nowIso,
    viewer_user_id: userId,
    buyer: {
      pending_payment: buyerBookings.filter(
        (row) => row.actions.pay.enabled,
      ).length,
      waiting_provider: buyerBookings.filter(
        (row) => row.next_step.code === "waiting_provider",
      ).length,
      upcoming: buyerBookings.filter(
        (row) =>
          row.booking_status === "accepted" &&
          new Date(row.scheduled_end_at).getTime() >= nowMs,
      ).length,
      attention: buyerBookings.filter(
        (row) => row.next_step.tone === "attention",
      ).length,
      completed: buyerBookings.filter(
        (row) => row.booking_status === "completed",
      ).length,
      bookings: buyerBookings,
    },
    provider: {
      awaiting_reply: providerBookings.filter(
        (row) => row.actions.accept.enabled || row.actions.decline.enabled,
      ).length,
      upcoming: providerBookings.filter(
        (row) =>
          row.booking_status === "accepted" &&
          new Date(row.scheduled_end_at).getTime() >= nowMs,
      ).length,
      completion_pending: providerBookings.filter(
        (row) => row.next_step.code === "viewer_completion_required",
      ).length,
      attention: providerBookings.filter(
        (row) => row.next_step.tone === "attention",
      ).length,
      active_services: serviceRows.filter((row) => row.status === "active").length,
      open_slots: serviceRows.reduce(
        (total, row) => total + row.open_slots_count,
        0,
      ),
      bookings: providerBookings,
      services: serviceRows,
    },
    payout: {
      held_twd: sumSettlement(providerSettlements, [
        "funds_held",
        "service_accepted",
        "completed_hold",
        "dispute_hold",
        "refund_pending",
        "manual_review",
      ]),
      releasable_twd: sumSettlement(providerSettlements, ["releasable"]),
      processing_twd: sumSettlement(providerSettlements, ["payout_processing"]),
      paid_out_twd: sumSettlement(providerSettlements, ["paid_out"]),
      account: payoutAccount
        ? {
            id: String(payoutAccount.id),
            status: asText(payoutAccount.status, "pending_review"),
            bank_code: asText(payoutAccount.bank_code),
            account_last5: asText(payoutAccount.account_last5),
            account_holder_name: asText(payoutAccount.account_holder_name),
            reviewer_note:
              payoutAccount.status === "rejected"
                ? asText(payoutAccount.reviewer_note) || null
                : null,
            verified_at: asIso(payoutAccount.verified_at),
            secure_reference_present: Boolean(
              payoutAccount.secure_provider_reference,
            ),
            updated_at: asIso(payoutAccount.updated_at) || nowIso,
          }
        : null,
      recent_items: ((payoutItemsResult.data ?? []) as any[]).map((item) => ({
        id: String(item.id),
        amount_twd: asNumber(item.amount_twd),
        status: asText(item.status),
        provider_reference: asText(item.provider_reference) || null,
        processed_at: asIso(item.processed_at),
        created_at: asIso(item.created_at) || nowIso,
      })),
    },
    build_tag: P4B_BUILD_TAGS.workspace,
    dependency_build_tag: P3_BUILD_TAGS.buddiesCommercial,
  };
}
