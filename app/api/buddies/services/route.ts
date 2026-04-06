import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { extractBearer, getAuthUserFromRequest, isVipUser } from "@/lib/serverRoomUtils";
import {
  BUDDIES_BUILD_TAG,
  isBuddyCategory,
  isBuddyDeliveryMode,
  isBuddyInteractionStyle,
  isBuddyServiceStatus,
  isBuddyServiceVisibility,
  isBuddySortKey,
  parseBuddyTagsInput,
  recommendScore,
  type BuddyCategory,
  type BuddyServiceListItem,
  type BuddyServiceRow,
  type BuddyServiceSlotRow,
  type PublicProfilePreview,
} from "@/lib/buddies";

export const runtime = "nodejs";

type ServicePayload = {
  id?: string;
  title?: string;
  summary?: string;
  description?: string | null;
  buddy_category?: BuddyCategory;
  interaction_style?: "silent" | "light-chat" | "guided" | "open-share";
  delivery_mode?: "remote" | "in_person" | "hybrid";
  visibility?: "public" | "members" | "friends";
  tag_list_input?: string;
  tag_list?: string[];
  price_per_hour_twd?: number;
  accepts_new_users?: boolean;
  accepts_last_minute?: boolean;
  availability_note?: string | null;
  status?: "draft" | "active" | "paused" | "archived";
};

type BookingStatRow = { service_id: string; booking_status: string };
type ReviewRow = { service_id: string; rating: number };

async function tryResolveViewer(req: Request) {
  const bearer = extractBearer(req);
  if (!bearer) return null;
  try {
    return await getAuthUserFromRequest(req);
  } catch {
    return null;
  }
}

async function decorateServices(serviceRows: BuddyServiceRow[]): Promise<BuddyServiceListItem[]> {
  const providerIds = Array.from(new Set(serviceRows.map((item) => item.provider_user_id)));
  const serviceIds = serviceRows.map((item) => item.id);

  const [profileResult, bookingStatResult, reviewResult, slotResult] = await Promise.all([
    providerIds.length
      ? supabaseAdmin
          .from("profiles")
          .select("user_id,handle,display_name,avatar_url,bio,tags,is_professional_buddy")
          .in("user_id", providerIds)
      : Promise.resolve({ data: [], error: null } as any),
    serviceIds.length
      ? supabaseAdmin.from("buddy_bookings").select("service_id,booking_status").in("service_id", serviceIds)
      : Promise.resolve({ data: [], error: null } as any),
    serviceIds.length
      ? supabaseAdmin.from("buddy_reviews").select("service_id,rating").in("service_id", serviceIds)
      : Promise.resolve({ data: [], error: null } as any),
    serviceIds.length
      ? supabaseAdmin.from("buddy_service_slots").select("service_id,slot_status").in("service_id", serviceIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (bookingStatResult.error) throw bookingStatResult.error;
  if (reviewResult.error) throw reviewResult.error;
  if (slotResult.error) throw slotResult.error;

  const profileMap = Object.fromEntries(
    ((profileResult.data ?? []) as PublicProfilePreview[]).map((item) => [item.user_id, item]),
  );

  const statMap = new Map<string, { completed: number; pending: number }>();
  ((bookingStatResult.data ?? []) as BookingStatRow[]).forEach((row) => {
    const bucket = statMap.get(row.service_id) ?? { completed: 0, pending: 0 };
    if (row.booking_status === "completed") bucket.completed += 1;
    if (row.booking_status === "pending" || row.booking_status === "accepted") bucket.pending += 1;
    statMap.set(row.service_id, bucket);
  });

  const reviewMap = new Map<string, { count: number; total: number }>();
  ((reviewResult.data ?? []) as ReviewRow[]).forEach((row) => {
    const bucket = reviewMap.get(row.service_id) ?? { count: 0, total: 0 };
    bucket.count += 1;
    bucket.total += row.rating;
    reviewMap.set(row.service_id, bucket);
  });

  const slotCountMap = new Map<string, number>();
  ((slotResult.data ?? []) as Array<Pick<BuddyServiceSlotRow, "service_id" | "slot_status">>).forEach((row) => {
    if (row.slot_status !== "open") return;
    slotCountMap.set(row.service_id, (slotCountMap.get(row.service_id) ?? 0) + 1);
  });

  return serviceRows.map((item) => {
    const stats = statMap.get(item.id) ?? { completed: 0, pending: 0 };
    const reviews = reviewMap.get(item.id) ?? { count: 0, total: 0 };
    return {
      ...item,
      provider_profile: profileMap[item.provider_user_id] ?? null,
      review_count: reviews.count,
      average_rating: reviews.count > 0 ? Number((reviews.total / reviews.count).toFixed(1)) : null,
      completed_bookings: stats.completed,
      pending_bookings: stats.pending,
      open_slots_count: slotCountMap.get(item.id) ?? 0,
    };
  });
}

function applySort(items: BuddyServiceListItem[], sortKey: string) {
  if (sortKey === "price_asc") return [...items].sort((a, b) => a.price_per_hour_twd - b.price_per_hour_twd);
  if (sortKey === "price_desc") return [...items].sort((a, b) => b.price_per_hour_twd - a.price_per_hour_twd);
  if (sortKey === "rating") return [...items].sort((a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0) || b.review_count - a.review_count);
  if (sortKey === "recent") return [...items].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  if (sortKey === "popular") return [...items].sort((a, b) => b.completed_bookings - a.completed_bookings || b.pending_bookings - a.pending_bookings);
  return [...items].sort((a, b) => recommendScore(b) - recommendScore(a));
}

function toBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizePayload(body: ServicePayload) {
  const title = (body.title ?? "").trim().slice(0, 80);
  const summary = (body.summary ?? "").trim().slice(0, 140);
  const description = (body.description ?? "").trim().slice(0, 2400) || null;
  const availabilityNote = (body.availability_note ?? "").trim().slice(0, 300) || null;
  const buddyCategory = body.buddy_category ?? "focus";
  const interactionStyle = body.interaction_style ?? "guided";
  const deliveryMode = body.delivery_mode ?? "remote";
  const visibility = body.visibility ?? "public";
  const status = body.status ?? "draft";
  const tagList = Array.isArray(body.tag_list)
    ? Array.from(new Set(body.tag_list.map((item) => String(item).trim()).filter(Boolean))).slice(0, 12)
    : parseBuddyTagsInput(body.tag_list_input ?? "");
  const price = Number(body.price_per_hour_twd ?? 0);
  const acceptsNewUsers = toBoolean(body.accepts_new_users, true);
  const acceptsLastMinute = toBoolean(body.accepts_last_minute, false);

  if (!title) throw new Error("請先填寫服務標題。");
  if (!summary) throw new Error("請先填寫服務摘要。");
  if (!isBuddyCategory(buddyCategory)) throw new Error("請選擇正確的服務分類。");
  if (!isBuddyInteractionStyle(interactionStyle)) throw new Error("請選擇正確的互動形式。");
  if (!isBuddyDeliveryMode(deliveryMode)) throw new Error("請選擇正確的提供方式。");
  if (!isBuddyServiceVisibility(visibility)) throw new Error("請選擇正確的可見性。");
  if (!isBuddyServiceStatus(status)) throw new Error("請選擇正確的服務狀態。");
  if (!Number.isFinite(price) || price < 100 || price > 20000) {
    throw new Error("每小時價格需介於 NT$100～NT$20,000。");
  }

  return {
    title,
    summary,
    description,
    buddy_category: buddyCategory,
    interaction_style: interactionStyle,
    delivery_mode: deliveryMode,
    visibility,
    tag_list: tagList,
    price_per_hour_twd: Math.round(price),
    accepts_new_users: acceptsNewUsers,
    accepts_last_minute: acceptsLastMinute,
    availability_note: availabilityNote,
    status,
  };
}

export async function GET(req: Request) {
  try {
    const viewer = await tryResolveViewer(req);
    const url = new URL(req.url);
    const mine = url.searchParams.get("mine") === "1";
    const category = url.searchParams.get("category") ?? "all";
    const keyword = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const delivery = url.searchParams.get("delivery") ?? "all";
    const onlyVerified = url.searchParams.get("verified") === "1";
    const sort = url.searchParams.get("sort") ?? "recommended";

    if (mine && !viewer?.userId) {
      return NextResponse.json({ error: "請先登入後再查看你的安感夥伴服務。", build_tag: BUDDIES_BUILD_TAG }, { status: 401 });
    }
    if (category !== "all" && !isBuddyCategory(category)) {
      return NextResponse.json({ error: "無效的分類篩選。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }
    if (delivery !== "all" && !isBuddyDeliveryMode(delivery)) {
      return NextResponse.json({ error: "無效的提供方式篩選。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }
    if (!isBuddySortKey(sort)) {
      return NextResponse.json({ error: "無效的排序條件。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }

    let query = supabaseAdmin.from("buddy_services").select("*").order("updated_at", { ascending: false }).limit(mine ? 120 : 80);
    query = mine && viewer?.userId ? query.eq("provider_user_id", viewer.userId) : query.eq("status", "active");
    if (category !== "all") query = query.eq("buddy_category", category);
    if (delivery !== "all") query = query.eq("delivery_mode", delivery);

    const serviceResult = await query;
    if (serviceResult.error) {
      return NextResponse.json({ error: serviceResult.error.message, build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }

    let items = await decorateServices((serviceResult.data ?? []) as BuddyServiceRow[]);

    if (!mine) {
      if (!viewer?.userId) {
        items = items.filter((item) => item.visibility === "public");
      } else {
        const [viewerVip, friendResult] = await Promise.all([
          isVipUser(viewer.userId),
          supabaseAdmin.from("friendships").select("user_low,user_high").or(`user_low.eq.${viewer.userId},user_high.eq.${viewer.userId}`),
        ]);
        if (friendResult.error) {
          return NextResponse.json({ error: friendResult.error.message, build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
        }
        const friendIds = new Set<string>();
        (friendResult.data ?? []).forEach((item: any) => {
          friendIds.add(item.user_low === viewer.userId ? item.user_high : item.user_low);
        });
        items = items.filter((item) => {
          if (item.provider_user_id === viewer.userId) return true;
          if (item.visibility === "public") return true;
          if (item.visibility === "members") return viewerVip;
          if (item.visibility === "friends") return friendIds.has(item.provider_user_id);
          return false;
        });
      }
    }

    if (keyword) {
      items = items.filter((item) => {
        const corpus = [
          item.title,
          item.summary,
          item.description ?? "",
          item.availability_note ?? "",
          item.buddy_category,
          item.delivery_mode,
          item.provider_profile?.display_name ?? "",
          item.provider_profile?.handle ?? "",
          ...(item.tag_list ?? []),
        ].join(" ").toLowerCase();
        return corpus.includes(keyword);
      });
    }

    if (onlyVerified) items = items.filter((item) => Boolean(item.provider_profile?.is_professional_buddy));
    items = applySort(items, sort);

    return NextResponse.json({ services: items, build_tag: BUDDIES_BUILD_TAG });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "讀取安感夥伴服務失敗。", build_tag: BUDDIES_BUILD_TAG }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const body = (await req.json()) as ServicePayload;
    const serviceId = (body.id ?? "").trim();
    const payload = normalizePayload(body);

    if (!serviceId) {
      const insertResult = await supabaseAdmin.from("buddy_services").insert({ provider_user_id: userId, ...payload }).select("*").single();
      if (insertResult.error || !insertResult.data) {
        return NextResponse.json({ error: insertResult.error?.message ?? "建立服務失敗。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
      }
      return NextResponse.json({ service: insertResult.data, build_tag: BUDDIES_BUILD_TAG });
    }

    const existingResult = await supabaseAdmin.from("buddy_services").select("id,provider_user_id").eq("id", serviceId).maybeSingle();
    if (existingResult.error || !existingResult.data) {
      return NextResponse.json({ error: existingResult.error?.message ?? "找不到要更新的服務。", build_tag: BUDDIES_BUILD_TAG }, { status: 404 });
    }
    if (existingResult.data.provider_user_id !== userId) {
      return NextResponse.json({ error: "你沒有權限修改這個服務。", build_tag: BUDDIES_BUILD_TAG }, { status: 403 });
    }

    const updateResult = await supabaseAdmin.from("buddy_services").update(payload).eq("id", serviceId).select("*").single();
    if (updateResult.error || !updateResult.data) {
      return NextResponse.json({ error: updateResult.error?.message ?? "更新服務失敗。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    }

    return NextResponse.json({ service: updateResult.data, build_tag: BUDDIES_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "請先登入後再管理安感夥伴服務。", build_tag: BUDDIES_BUILD_TAG }, { status: 401 });
    }
    return NextResponse.json({ error: error?.message || "Unexpected server error", build_tag: BUDDIES_BUILD_TAG }, { status: 500 });
  }
}
