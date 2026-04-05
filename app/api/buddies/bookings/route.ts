import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { areUsersFriends, getAuthUserFromRequest, isVipUser } from "@/lib/serverRoomUtils";
import {
  BUDDIES_BUILD_TAG,
  computeBookingEndAt,
  type BuddyBookingFeedItem,
  type BuddyBookingRow,
  type BuddyServiceRow,
  type PublicProfilePreview,
} from "@/lib/buddies";

export const runtime = "nodejs";

type CreateBookingBody = {
  service_id?: string;
  scheduled_start_at?: string;
  hours_booked?: number;
  buyer_note?: string | null;
};

async function decorateBookings(rows: BuddyBookingRow[]): Promise<BuddyBookingFeedItem[]> {
  const serviceIds = Array.from(new Set(rows.map((item) => item.service_id)));
  const profileIds = Array.from(new Set(rows.flatMap((item) => [item.buyer_user_id, item.provider_user_id])));

  const [serviceResult, profileResult] = await Promise.all([
    serviceIds.length
      ? supabaseAdmin
          .from("buddy_services")
          .select("id,title,summary,buddy_category,interaction_style,delivery_mode,price_per_hour_twd,tag_list")
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

    return NextResponse.json({
      bookings: items,
      build_tag: BUDDIES_BUILD_TAG,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "請先登入後再查看你的安感夥伴預約。", build_tag: BUDDIES_BUILD_TAG },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: error?.message || "讀取安感夥伴預約失敗。", build_tag: BUDDIES_BUILD_TAG },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const body = (await req.json()) as CreateBookingBody;

    const serviceId = (body.service_id ?? "").trim();
    const startAtRaw = (body.scheduled_start_at ?? "").trim();
    const hoursBooked = Number(body.hours_booked ?? 1);
    const buyerNote = (body.buyer_note ?? "").trim().slice(0, 800) || null;

    if (!serviceId) {
      return NextResponse.json({ error: "請先指定要預約的服務。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }
    if (!startAtRaw) {
      return NextResponse.json({ error: "請先選擇預約開始時間。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }
    if (!Number.isInteger(hoursBooked) || hoursBooked < 1 || hoursBooked > 4) {
      return NextResponse.json({ error: "每次預約只支援 1～4 小時。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }

    const scheduledStartAt = new Date(startAtRaw);
    if (Number.isNaN(scheduledStartAt.getTime()) || scheduledStartAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "預約時間必須晚於現在。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }

    const serviceResult = await supabaseAdmin
      .from("buddy_services")
      .select("*")
      .eq("id", serviceId)
      .maybeSingle();

    const service = serviceResult.data as BuddyServiceRow | null;
    if (serviceResult.error || !service) {
      return NextResponse.json({ error: serviceResult.error?.message ?? "找不到指定服務。", build_tag: BUDDIES_BUILD_TAG }, { status: 404 });
    }

    if (service.provider_user_id === userId) {
      return NextResponse.json({ error: "你不能預約自己的服務。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }

    if (service.status !== "active") {
      return NextResponse.json({ error: "這個服務目前沒有開放預約。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }

    let allowed = false;
    if (service.visibility === "public") {
      allowed = true;
    } else if (service.visibility === "members") {
      allowed = await isVipUser(userId);
    } else if (service.visibility === "friends") {
      allowed = await areUsersFriends(userId, service.provider_user_id);
    }

    if (!allowed) {
      return NextResponse.json({ error: "你目前沒有權限預約這個服務。", build_tag: BUDDIES_BUILD_TAG }, { status: 403 });
    }

    const totalAmount = service.price_per_hour_twd * hoursBooked;

    const insertResult = await supabaseAdmin
      .from("buddy_bookings")
      .insert({
        service_id: service.id,
        buyer_user_id: userId,
        provider_user_id: service.provider_user_id,
        scheduled_start_at: scheduledStartAt.toISOString(),
        scheduled_end_at: computeBookingEndAt(scheduledStartAt.toISOString(), hoursBooked),
        hours_booked: hoursBooked,
        total_amount_twd: totalAmount,
        booking_status: "pending",
        payment_status: "unpaid",
        buyer_note: buyerNote,
      })
      .select("*")
      .single();

    if (insertResult.error || !insertResult.data) {
      return NextResponse.json(
        { error: insertResult.error?.message ?? "建立安感夥伴預約失敗。", build_tag: BUDDIES_BUILD_TAG },
        { status: 400 },
      );
    }

    return NextResponse.json({
      booking: insertResult.data,
      build_tag: BUDDIES_BUILD_TAG,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "請先登入後再預約安感夥伴。", build_tag: BUDDIES_BUILD_TAG },
        { status: 401 },
      );
    }
    return NextResponse.json({ error: error?.message || "Unexpected server error", build_tag: BUDDIES_BUILD_TAG }, { status: 500 });
  }
}
