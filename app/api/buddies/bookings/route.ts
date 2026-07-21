import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { areUsersFriends, isVipUser } from "@/lib/serverRoomUtils";
import {
  BUDDIES_BUILD_TAG,
  type BuddyBookingFeedItem,
  type BuddyBookingRow,
  type BuddyServiceRow,
  type PublicProfilePreview,
} from "@/lib/buddies";
import {
  identityAccessErrorResponse,
  requireBuddiesRealNameVerifiedForRequest,
} from "@/lib/server/identityAccess";
import {
  assertCommercialBookingAmount,
  assertPilotDeliveryMode,
  requireApprovedBuddyProvider,
  requireBuddiesCommercialPilot,
} from "@/lib/server/buddySettlement";
import {
  P3_BUILD_TAGS,
  buddiesMaxBookingAmountTwd,
  buddiesMaxBookingHours,
} from "@/lib/p3Status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateBookingBody = {
  service_id?: string;
  slot_id?: string;
  buyer_note?: string | null;
};

async function decorateBookings(
  rows: BuddyBookingRow[],
  viewerUserId: string,
): Promise<BuddyBookingFeedItem[]> {
  const serviceIds = Array.from(new Set(rows.map((item) => item.service_id)));
  const profileIds = Array.from(
    new Set(rows.flatMap((item) => [item.buyer_user_id, item.provider_user_id])),
  );
  const bookingIds = rows.map((item) => item.id);

  const [servicesResult, profilesResult, settlementsResult] = await Promise.all([
    serviceIds.length
      ? supabaseAdmin
          .from("buddy_services")
          .select(
            "id,title,summary,buddy_category,interaction_style,delivery_mode,price_per_hour_twd,tag_list,accepts_new_users,accepts_last_minute,availability_note",
          )
          .in("id", serviceIds)
      : Promise.resolve({ data: [], error: null } as any),
    profileIds.length
      ? supabaseAdmin
          .from("profiles")
          .select(
            "user_id,handle,display_name,avatar_url,bio,tags,is_professional_buddy",
          )
          .in("user_id", profileIds)
      : Promise.resolve({ data: [], error: null } as any),
    bookingIds.length
      ? supabaseAdmin
          .from("buddy_settlements")
          .select(
            "booking_id,status,gross_amount_twd,platform_fee_twd,provider_net_twd,available_for_payout_at,paid_out_at,hold_reason",
          )
          .in("booking_id", bookingIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (servicesResult.error) throw servicesResult.error;
  if (profilesResult.error) throw profilesResult.error;
  if (settlementsResult.error) throw settlementsResult.error;

  const services = Object.fromEntries(
    ((servicesResult.data ?? []) as Partial<BuddyServiceRow>[]).map((item: any) => [
      item.id,
      item,
    ]),
  );
  const profiles = Object.fromEntries(
    ((profilesResult.data ?? []) as PublicProfilePreview[]).map((item) => [
      item.user_id,
      item,
    ]),
  );
  const settlements = Object.fromEntries(
    (settlementsResult.data ?? []).map((item: any) => [item.booking_id, item]),
  );

  return rows.map((item) => ({
    ...item,
    service: (services[item.service_id] as any) ?? null,
    buyer_profile: profiles[item.buyer_user_id] ?? null,
    provider_profile: profiles[item.provider_user_id] ?? null,
    commercial_settlement: settlements[item.id] ?? null,
    viewer_role: item.buyer_user_id === viewerUserId ? "buyer" : "provider",
  })) as BuddyBookingFeedItem[];
}

export async function GET(req: Request) {
  try {
    const { userId } = await requireBuddiesRealNameVerifiedForRequest(req);
    const result = await supabaseAdmin
      .from("buddy_bookings")
      .select("*")
      .or(`buyer_user_id.eq.${userId},provider_user_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(120);
    if (result.error) {
      return NextResponse.json(
        { error: result.error.message, build_tag: P3_BUILD_TAGS.buddiesCommercial },
        { status: 400 },
      );
    }
    const items = await decorateBookings(
      (result.data ?? []) as BuddyBookingRow[],
      userId,
    );
    return NextResponse.json({
      bookings: items,
      build_tag: P3_BUILD_TAGS.buddiesCommercial,
      legacy_build_tag: BUDDIES_BUILD_TAG,
    });
  } catch (error: any) {
    const mapped = identityAccessErrorResponse(
      error,
      P3_BUILD_TAGS.buddiesCommercial,
    );
    if (mapped) return mapped;
    return NextResponse.json(
      {
        error: error?.message || "讀取安感夥伴預約失敗。",
        code: error?.code,
        build_tag: P3_BUILD_TAGS.buddiesCommercial,
      },
      { status: Number(error?.status || 500) },
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireBuddiesRealNameVerifiedForRequest(req);
    requireBuddiesCommercialPilot(userId);

    const body = (await req.json().catch(() => ({}))) as CreateBookingBody;
    const serviceId = String(body.service_id || "").trim();
    const slotId = String(body.slot_id || "").trim();
    const buyerNote = String(body.buyer_note || "").trim().slice(0, 800) || null;
    if (!serviceId || !slotId) {
      return NextResponse.json(
        {
          error: "請先選擇服務與可預約時段。",
          build_tag: P3_BUILD_TAGS.buddiesCommercial,
        },
        { status: 400 },
      );
    }

    const [serviceResult, slotResult] = await Promise.all([
      supabaseAdmin.from("buddy_services").select("*").eq("id", serviceId).maybeSingle(),
      supabaseAdmin
        .from("buddy_service_slots")
        .select("*")
        .eq("id", slotId)
        .maybeSingle(),
    ]);
    if (serviceResult.error || !serviceResult.data) {
      return NextResponse.json(
        { error: serviceResult.error?.message || "找不到指定服務。" },
        { status: 404 },
      );
    }
    if (slotResult.error || !slotResult.data) {
      return NextResponse.json(
        { error: slotResult.error?.message || "找不到指定時段。" },
        { status: 404 },
      );
    }

    const service = serviceResult.data as any;
    const slot = slotResult.data as any;
    if (service.provider_user_id === userId) {
      return NextResponse.json({ error: "你不能預約自己的服務。" }, { status: 400 });
    }
    if (service.status !== "active" || slot.slot_status !== "open") {
      return NextResponse.json(
        { error: "這個服務或時段目前無法預約。" },
        { status: 409 },
      );
    }
    if (
      slot.service_id !== service.id ||
      slot.provider_user_id !== service.provider_user_id
    ) {
      return NextResponse.json({ error: "時段與服務不一致。" }, { status: 400 });
    }

    assertPilotDeliveryMode(String(service.delivery_mode || ""));
    await requireApprovedBuddyProvider(service.provider_user_id);

    let allowed = service.visibility === "public";
    if (service.visibility === "members") allowed = await isVipUser(userId);
    if (service.visibility === "friends") {
      allowed = await areUsersFriends(userId, service.provider_user_id);
    }
    if (!allowed) {
      return NextResponse.json(
        { error: "你目前沒有權限預約這個服務。" },
        { status: 403 },
      );
    }

    const hoursBooked = Math.max(
      1,
      Math.round(
        (new Date(slot.ends_at).getTime() - new Date(slot.starts_at).getTime()) /
          3_600_000,
      ),
    );
    if (hoursBooked > buddiesMaxBookingHours()) {
      return NextResponse.json(
        { error: `受控試營運單筆最多 ${buddiesMaxBookingHours()} 小時。` },
        { status: 400 },
      );
    }
    const amount = Number(service.price_per_hour_twd || 0) * hoursBooked;
    await assertCommercialBookingAmount(amount);

    const created = await supabaseAdmin.rpc("cowork_create_buddy_booking_v3", {
      p_buyer_user_id: userId,
      p_service_id: serviceId,
      p_slot_id: slotId,
      p_buyer_note: buyerNote,
      p_max_amount_twd: buddiesMaxBookingAmountTwd(),
    });
    if (created.error) {
      const status = /SLOT_NOT_OPEN|SLOT_ALREADY_BOOKED/.test(created.error.message)
        ? 409
        : 400;
      return NextResponse.json(
        {
          error: created.error.message,
          build_tag: P3_BUILD_TAGS.buddiesCommercial,
        },
        { status },
      );
    }

    return NextResponse.json({
      booking: created.data,
      next_url: "/account/buddies/bookings",
      payment_required: true,
      build_tag: P3_BUILD_TAGS.buddiesCommercial,
    });
  } catch (error: any) {
    const mapped = identityAccessErrorResponse(
      error,
      P3_BUILD_TAGS.buddiesCommercial,
    );
    if (mapped) return mapped;
    return NextResponse.json(
      {
        error: error?.message || "建立安感夥伴預約失敗。",
        code: error?.code,
        build_tag: P3_BUILD_TAGS.buddiesCommercial,
      },
      { status: Number(error?.status || 500) },
    );
  }
}
