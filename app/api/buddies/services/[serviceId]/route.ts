import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { areUsersFriends, extractBearer, getAuthUserFromRequest, isVipUser } from "@/lib/serverRoomUtils";
import {
  BUDDIES_BUILD_TAG,
  isBuddyCategory,
  isBuddyInteractionStyle,
  isBuddyDeliveryMode,
  isBuddyServiceVisibility,
  isBuddyServiceStatus,
  type BuddyReviewFeedItem,
  type BuddyReviewRow,
  type BuddyServiceDetail,
  type BuddyServiceListItem,
  type BuddyServiceRow,
  type BuddyServiceSlotRow,
  type PublicProfilePreview,
} from "@/lib/buddies";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ serviceId: string }> };

async function tryResolveViewer(req: Request) {
  const bearer = extractBearer(req);
  if (!bearer) return null;
  try {
    return await getAuthUserFromRequest(req);
  } catch {
    return null;
  }
}

async function decorateService(service: BuddyServiceRow): Promise<BuddyServiceDetail> {
  const [profileResult, reviewResult, bookingResult, slotsResult] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("user_id,handle,display_name,avatar_url,bio,tags,is_professional_buddy")
      .eq("user_id", service.provider_user_id)
      .maybeSingle(),
    supabaseAdmin
      .from("buddy_reviews")
      .select("id,booking_id,service_id,reviewer_user_id,reviewee_user_id,rating,comment,created_at")
      .eq("service_id", service.id)
      .order("created_at", { ascending: false })
      .limit(12),
    supabaseAdmin
      .from("buddy_bookings")
      .select("booking_status")
      .eq("service_id", service.id),
    supabaseAdmin
      .from("buddy_service_slots")
      .select("*")
      .eq("service_id", service.id)
      .eq("slot_status", "open")
      .gt("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(24),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (reviewResult.error) throw reviewResult.error;
  if (bookingResult.error) throw bookingResult.error;
  if (slotsResult.error) throw slotsResult.error;

  const reviews = (reviewResult.data ?? []) as BuddyReviewRow[];
  const reviewerIds = Array.from(new Set(reviews.map((item) => item.reviewer_user_id)));

  const reviewerProfilesResult = reviewerIds.length
    ? await supabaseAdmin
        .from("profiles")
        .select("user_id,handle,display_name,avatar_url,bio,tags,is_professional_buddy")
        .in("user_id", reviewerIds)
    : { data: [], error: null };

  if (reviewerProfilesResult.error) throw reviewerProfilesResult.error;

  const reviewerMap = Object.fromEntries(((reviewerProfilesResult.data ?? []) as PublicProfilePreview[]).map((item) => [item.user_id, item]));
  const reviewCount = reviews.length;
  const averageRating = reviewCount > 0 ? Number((reviews.reduce((sum, item) => sum + item.rating, 0) / reviewCount).toFixed(1)) : null;
  const bookingRows = (bookingResult.data ?? []) as Array<{ booking_status: string }>;

  const detail: BuddyServiceDetail = {
    ...service,
    provider_profile: (profileResult.data as PublicProfilePreview | null) ?? null,
    review_count: reviewCount,
    average_rating: averageRating,
    completed_bookings: bookingRows.filter((item) => item.booking_status === "completed").length,
    pending_bookings: bookingRows.filter((item) => item.booking_status === "pending" || item.booking_status === "accepted").length,
    open_slots_count: (slotsResult.data ?? []).length,
    upcoming_slots: (slotsResult.data ?? []) as BuddyServiceSlotRow[],
    recent_reviews: reviews.map((item) => ({ ...item, reviewer_profile: reviewerMap[item.reviewer_user_id] ?? null })),
  };

  return detail;
}

export async function GET(req: Request, context: RouteContext) {
  try {
    const viewer = await tryResolveViewer(req);
    const { serviceId } = await context.params;

    const serviceResult = await supabaseAdmin.from("buddy_services").select("*").eq("id", serviceId).maybeSingle();
    const service = serviceResult.data as BuddyServiceRow | null;

    if (serviceResult.error || !service) {
      return NextResponse.json({ error: serviceResult.error?.message ?? "找不到這個服務。", build_tag: BUDDIES_BUILD_TAG }, { status: 404 });
    }

    let allowed = false;
    if (viewer?.userId === service.provider_user_id) allowed = true;
    else if (service.status === "active") {
      if (service.visibility === "public") allowed = true;
      else if (viewer?.userId && service.visibility === "members") allowed = await isVipUser(viewer.userId);
      else if (viewer?.userId && service.visibility === "friends") allowed = await areUsersFriends(viewer.userId, service.provider_user_id);
    }

    if (!allowed) {
      return NextResponse.json({ error: "你目前沒有權限查看這個服務。", build_tag: BUDDIES_BUILD_TAG }, { status: 403 });
    }

    const detail = await decorateService(service);
    return NextResponse.json({ service: detail, build_tag: BUDDIES_BUILD_TAG });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "讀取服務詳情失敗。", build_tag: BUDDIES_BUILD_TAG }, { status: 500 });
  }
}
