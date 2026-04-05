import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { extractBearer, getAuthUserFromRequest, isVipUser } from "@/lib/serverRoomUtils";
import {
  BUDDIES_BUILD_TAG,
  buddyTagsToInput,
  isBuddyCategory,
  isBuddyDeliveryMode,
  isBuddyInteractionStyle,
  isBuddyServiceStatus,
  isBuddyServiceVisibility,
  parseBuddyTagsInput,
  type BuddyCategory,
  type BuddyServiceListItem,
  type BuddyServiceRow,
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
  status?: "draft" | "active" | "paused" | "archived";
};

type BookingStatRow = {
  service_id: string;
  booking_status: string;
};

type ReviewRow = {
  service_id: string;
  rating: number;
};

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

  const [profileResult, bookingStatResult, reviewResult] = await Promise.all([
    providerIds.length
      ? supabaseAdmin
          .from("profiles")
          .select("user_id,handle,display_name,avatar_url,bio,tags,is_professional_buddy")
          .in("user_id", providerIds)
      : Promise.resolve({ data: [], error: null } as any),
    serviceIds.length
      ? supabaseAdmin
          .from("buddy_bookings")
          .select("service_id,booking_status")
          .in("service_id", serviceIds)
      : Promise.resolve({ data: [], error: null } as any),
    serviceIds.length
      ? supabaseAdmin
          .from("buddy_reviews")
          .select("service_id,rating")
          .in("service_id", serviceIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (bookingStatResult.error) throw bookingStatResult.error;
  if (reviewResult.error) throw reviewResult.error;

  const profiles = Object.fromEntries(
    ((profileResult.data ?? []) as PublicProfilePreview[]).map((item) => [item.user_id, item]),
  );

  const bookingStats = new Map<string, { completed: number; pending: number }>();
  ((bookingStatResult.data ?? []) as BookingStatRow[]).forEach((item) => {
    const stat = bookingStats.get(item.service_id) ?? { completed: 0, pending: 0 };
    if (item.booking_status === "completed") stat.completed += 1;
    if (item.booking_status === "pending") stat.pending += 1;
    bookingStats.set(item.service_id, stat);
  });

  const reviewStats = new Map<string, { count: number; total: number }>();
  ((reviewResult.data ?? []) as ReviewRow[]).forEach((item) => {
    const stat = reviewStats.get(item.service_id) ?? { count: 0, total: 0 };
    stat.count += 1;
    stat.total += Number(item.rating ?? 0);
    reviewStats.set(item.service_id, stat);
  });

  return serviceRows.map((service) => {
    const bookingStat = bookingStats.get(service.id) ?? { completed: 0, pending: 0 };
    const reviewStat = reviewStats.get(service.id) ?? { count: 0, total: 0 };
    return {
      ...service,
      provider_profile: profiles[service.provider_user_id] ?? null,
      review_count: reviewStat.count,
      average_rating: reviewStat.count ? Number((reviewStat.total / reviewStat.count).toFixed(1)) : null,
      completed_bookings: bookingStat.completed,
      pending_bookings: bookingStat.pending,
    };
  });
}

function validatePayload(body: ServicePayload) {
  const title = (body.title ?? "").trim().slice(0, 80);
  const summary = (body.summary ?? "").trim().slice(0, 140);
  const description = (body.description ?? "").trim().slice(0, 2000) || null;
  const buddyCategory = body.buddy_category ?? "focus";
  const interactionStyle = body.interaction_style ?? "guided";
  const deliveryMode = body.delivery_mode ?? "remote";
  const visibility = body.visibility ?? "public";
  const status = body.status ?? "draft";
  const price = Number(body.price_per_hour_twd ?? 0);
  const tagsInput = body.tag_list_input ?? buddyTagsToInput(body.tag_list ?? []);
  const tagList = parseBuddyTagsInput(tagsInput);

  if (!title) throw new Error("請先填寫服務名稱。");
  if (!summary) throw new Error("請先填寫 140 字內服務摘要。");
  if (!isBuddyCategory(buddyCategory)) throw new Error("服務分類不正確。");
  if (!isBuddyInteractionStyle(interactionStyle)) throw new Error("互動形式不正確。");
  if (!isBuddyDeliveryMode(deliveryMode)) throw new Error("服務方式不正確。");
  if (!isBuddyServiceVisibility(visibility)) throw new Error("可見性不正確。");
  if (!isBuddyServiceStatus(status)) throw new Error("服務狀態不正確。");
  if (!Number.isFinite(price) || price < 100 || price > 20000) {
    throw new Error("每小時價格請填 100～20000 之間的整數。");
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
    status,
    price_per_hour_twd: Math.round(price),
  };
}

export async function GET(req: Request) {
  try {
    const viewer = await tryResolveViewer(req);
    const url = new URL(req.url);
    const mine = url.searchParams.get("mine") === "1";
    const category = url.searchParams.get("category") ?? "all";
    const keyword = (url.searchParams.get("q") ?? "").trim().toLowerCase();

    if (mine && !viewer?.userId) {
      return NextResponse.json(
        { error: "請先登入後再查看你的安感夥伴服務。", build_tag: BUDDIES_BUILD_TAG },
        { status: 401 },
      );
    }

    let serviceQuery = supabaseAdmin
      .from("buddy_services")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(mine ? 100 : 60);

    if (mine && viewer?.userId) {
      serviceQuery = serviceQuery.eq("provider_user_id", viewer.userId);
    } else {
      serviceQuery = serviceQuery.eq("status", "active");
    }

    if (category !== "all") {
      if (!isBuddyCategory(category)) {
        return NextResponse.json({ error: "無效的分類篩選。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
      }
      serviceQuery = serviceQuery.eq("buddy_category", category);
    }

    const serviceResult = await serviceQuery;
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
          supabaseAdmin
            .from("friendships")
            .select("user_low,user_high")
            .or(`user_low.eq.${viewer.userId},user_high.eq.${viewer.userId}`),
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
        const provider = item.provider_profile;
        const corpus = [
          item.title,
          item.summary,
          item.description ?? "",
          item.buddy_category,
          item.delivery_mode,
          ...(item.tag_list ?? []),
          provider?.display_name ?? "",
          provider?.handle ?? "",
          ...(provider?.tags ?? []),
        ]
          .join(" ")
          .toLowerCase();
        return corpus.includes(keyword);
      });
    }

    return NextResponse.json({
      services: items,
      build_tag: BUDDIES_BUILD_TAG,
      viewer_user_id: viewer?.userId ?? null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "讀取安感夥伴服務失敗。", build_tag: BUDDIES_BUILD_TAG },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const body = (await req.json()) as ServicePayload;
    const payload = validatePayload(body);

    let result;
    if (body.id) {
      result = await supabaseAdmin
        .from("buddy_services")
        .update(payload)
        .eq("id", body.id)
        .eq("provider_user_id", userId)
        .select("*")
        .single();
    } else {
      result = await supabaseAdmin
        .from("buddy_services")
        .insert({
          provider_user_id: userId,
          ...payload,
        })
        .select("*")
        .single();
    }

    if (result.error || !result.data) {
      return NextResponse.json(
        { error: result.error?.message ?? "儲存安感夥伴服務失敗。", build_tag: BUDDIES_BUILD_TAG },
        { status: 400 },
      );
    }

    const decorated = await decorateServices([result.data as BuddyServiceRow]);

    return NextResponse.json({
      service: decorated[0],
      build_tag: BUDDIES_BUILD_TAG,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "請先登入後再管理安感夥伴服務。", build_tag: BUDDIES_BUILD_TAG },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: error?.message || "Unexpected server error", build_tag: BUDDIES_BUILD_TAG },
      { status: 500 },
    );
  }
}
