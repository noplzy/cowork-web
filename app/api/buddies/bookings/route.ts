import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { areUsersFriends, getAuthUserFromRequest, isVipUser } from "@/lib/serverRoomUtils";
import {
  BUDDIES_BUILD_TAG,
  type BuddyBookingFeedItem,
  type BuddyBookingRow,
  type BuddyServiceRow,
  type BuddyServiceSlotRow,
  type PublicProfilePreview,
} from "@/lib/buddies";

export const runtime = "nodejs";

type CreateBookingBody = {
  service_id?: string;
  slot_id?: string;
  buyer_note?: string | null;
};

async function decorateBookings(rows: BuddyBookingRow[]): Promise<BuddyBookingFeedItem[]> {
  const serviceIds = Array.from(new Set(rows.map((item) => item.service_id)));
  const profileIds = Array.from(new Set(rows.flatMap((item) => [item.buyer_user_id, item.provider_user_id])));

  const [serviceResult, profileResult] = await Promise.all([
    serviceIds.length
      ? supabaseAdmin
          .from("buddy_services")
          .select("id,title,summary,buddy_category,interaction_style,delivery_mode,price_per_hour_twd,tag_list,accepts_new_users,accepts_last_minute,availability_note")
          .in("id", serviceIds)
      : Promise.resolve({ data: [], error: null } as any),
    profileIds.length
      ? supabaseAdmin
          .from("profiles")
          .select("user_id,handle,display_name,avatar_url,bio,tags,is_professional_buddy")
          .in("user_id", profileIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (serviceResult.error) throw serviceResult.error;
  if (profileResult.error) throw profileResult.error;

  const services = Object.fromEntries(((serviceResult.data ?? []) as Partial<BuddyServiceRow>[]).map((item: any) => [item.id, item]));
  const profiles = Object.fromEntries(((profileResult.data ?? []) as PublicProfilePreview[]).map((item) => [item.user_id, item]));

  return rows.map((item) => ({
    ...item,
    service: (services[item.service_id] as any) ?? null,
    buyer_profile: profiles[item.buyer_user_id] ?? null,
    provider_profile: profiles[item.provider_user_id] ?? null,
  }));
}

export async function GET(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const result = await supabaseAdmin
      .from("buddy_bookings")
      .select("*")
      .or(`buyer_user_id.eq.${userId},provider_user_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(120);

    if (result.error) {
      return NextResponse.json({ error: result.error.message, build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }

    const items = await decorateBookings((result.data ?? []) as BuddyBookingRow[]);
    return NextResponse.json({ bookings: items, build_tag: BUDDIES_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "請先登入後再查看你的安感夥伴預約。", build_tag: BUDDIES_BUILD_TAG }, { status: 401 });
    }
    return NextResponse.json({ error: error?.message || "讀取安感夥伴預約失敗。", build_tag: BUDDIES_BUILD_TAG }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const body = (await req.json()) as CreateBookingBody;

    const serviceId = (body.service_id ?? "").trim();
    const slotId = (body.slot_id ?? "").trim();
    const buyerNote = (body.buyer_note ?? "").trim().slice(0, 800) || null;

    if (!serviceId) {
      return NextResponse.json({ error: "請先指定要預約的服務。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }
    if (!slotId) {
      return NextResponse.json({ error: "請先選擇可預約時段。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }

    const [serviceResult, slotResult] = await Promise.all([
      supabaseAdmin.from("buddy_services").select("*").eq("id", serviceId).maybeSingle(),
      supabaseAdmin.from("buddy_service_slots").select("*").eq("id", slotId).maybeSingle(),
    ]);

    const service = serviceResult.data as BuddyServiceRow | null;
    const slot = slotResult.data as BuddyServiceSlotRow | null;

    if (serviceResult.error || !service) {
      return NextResponse.json({ error: serviceResult.error?.message ?? "找不到指定服務。", build_tag: BUDDIES_BUILD_TAG }, { status: 404 });
    }
    if (slotResult.error || !slot) {
      return NextResponse.json({ error: slotResult.error?.message ?? "找不到指定時段。", build_tag: BUDDIES_BUILD_TAG }, { status: 404 });
    }
    if (slot.service_id !== service.id || slot.provider_user_id !== service.provider_user_id) {
      return NextResponse.json({ error: "時段與服務不一致。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }
    if (service.provider_user_id === userId) {
      return NextResponse.json({ error: "你不能預約自己的服務。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }
    if (service.status !== "active") {
      return NextResponse.json({ error: "這個服務目前沒有開放預約。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }
    if (slot.slot_status !== "open") {
      return NextResponse.json({ error: "這個時段目前無法預約。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }

    let allowed = false;
    if (service.visibility === "public") allowed = true;
    else if (service.visibility === "members") allowed = await isVipUser(userId);
    else if (service.visibility === "friends") allowed = await areUsersFriends(userId, service.provider_user_id);

    if (!allowed) {
      return NextResponse.json({ error: "你目前沒有權限預約這個服務。", build_tag: BUDDIES_BUILD_TAG }, { status: 403 });
    }

    const hoursBooked = Math.max(1, Math.round((new Date(slot.ends_at).getTime() - new Date(slot.starts_at).getTime()) / (60 * 60 * 1000)));
    const totalAmount = service.price_per_hour_twd * hoursBooked;

    const existingPending = await supabaseAdmin
      .from("buddy_bookings")
      .select("id")
      .eq("slot_id", slot.id)
      .in("booking_status", ["pending", "accepted"])
      .limit(1);

    if (existingPending.error) {
      return NextResponse.json({ error: existingPending.error.message, build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }
    if ((existingPending.data ?? []).length > 0) {
      return NextResponse.json({ error: "這個時段剛剛已被預約，請重新整理。", build_tag: BUDDIES_BUILD_TAG }, { status: 409 });
    }

    const insertResult = await supabaseAdmin
      .from("buddy_bookings")
      .insert({
        service_id: service.id,
        slot_id: slot.id,
        buyer_user_id: userId,
        provider_user_id: service.provider_user_id,
        scheduled_start_at: slot.starts_at,
        scheduled_end_at: slot.ends_at,
        hours_booked: hoursBooked,
        total_amount_twd: totalAmount,
        booking_status: "pending",
        payment_status: "unpaid",
        buyer_note: buyerNote,
      })
      .select("*")
      .single();

    if (insertResult.error || !insertResult.data) {
      return NextResponse.json({ error: insertResult.error?.message ?? "建立安感夥伴預約失敗。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }

    return NextResponse.json({ booking: insertResult.data, build_tag: BUDDIES_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "請先登入後再預約安感夥伴。", build_tag: BUDDIES_BUILD_TAG }, { status: 401 });
    }
    return NextResponse.json({ error: error?.message || "Unexpected server error", build_tag: BUDDIES_BUILD_TAG }, { status: 500 });
  }
}
