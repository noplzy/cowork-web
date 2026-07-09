import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { areUsersFriends, extractBearer, getAuthUserFromRequest, isVipUser } from "@/lib/serverRoomUtils";
import { BUDDIES_BUILD_TAG } from "@/lib/buddies";

export const runtime = "nodejs";
type Context = { params: Promise<{ serviceId: string }> };

async function tryViewer(req: Request) {
  if (!extractBearer(req)) return null;
  try { return await getAuthUserFromRequest(req); } catch { return null; }
}

async function canViewService(req: Request, service: any) {
  if (service.visibility === "public") return { ok: true, viewer: await tryViewer(req) };
  const viewer = await tryViewer(req);
  if (!viewer?.userId) return { ok: false, viewer: null, status: 401, error: "請先登入後再查看這個服務。" };
  if (service.provider_user_id === viewer.userId) return { ok: true, viewer };
  if (service.visibility === "members") return { ok: await isVipUser(viewer.userId), viewer, status: 403, error: "這個服務目前只開放會員查看。" };
  if (service.visibility === "friends") return { ok: await areUsersFriends(viewer.userId, service.provider_user_id), viewer, status: 403, error: "這個服務目前只開放好友查看。" };
  return { ok: false, viewer, status: 403, error: "你目前沒有權限查看這個服務。" };
}

export async function GET(req: Request, context: Context) {
  try {
    const { serviceId } = await context.params;
    const serviceResult = await supabaseAdmin.from("buddy_services").select("*").eq("id", serviceId).maybeSingle();
    if (serviceResult.error || !serviceResult.data) return NextResponse.json({ error: serviceResult.error?.message || "找不到服務。", build_tag: BUDDIES_BUILD_TAG }, { status: 404 });
    const service = serviceResult.data as any;
    const gate = await canViewService(req, service);
    if (!gate.ok) return NextResponse.json({ error: gate.error, build_tag: BUDDIES_BUILD_TAG }, { status: gate.status || 403 });

    const [profileResult, slotsResult, reviewsResult, approvedIdentityResult] = await Promise.all([
      supabaseAdmin.from("profiles").select("user_id,handle,display_name,avatar_url,bio,tags,is_professional_buddy").eq("user_id", service.provider_user_id).maybeSingle(),
      supabaseAdmin.from("buddy_service_slots").select("*").eq("service_id", service.id).eq("slot_status", "open").gte("starts_at", new Date().toISOString()).order("starts_at", { ascending: true }).limit(40),
      supabaseAdmin.from("buddy_reviews").select("*").eq("service_id", service.id).order("created_at", { ascending: false }).limit(20),
      supabaseAdmin.from("identity_verification_requests").select("id,review_status,reviewed_at").eq("user_id", service.provider_user_id).eq("review_status", "approved").limit(1),
    ]);

    if (profileResult.error) return NextResponse.json({ error: profileResult.error.message, build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    if (slotsResult.error) return NextResponse.json({ error: slotsResult.error.message, build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    if (reviewsResult.error) return NextResponse.json({ error: reviewsResult.error.message, build_tag: BUDDIES_BUILD_TAG }, { status: 400 });

    const reviews = reviewsResult.data ?? [];
    const average = reviews.length ? Number((reviews.reduce((sum: number, item: any) => sum + Number(item.rating || 0), 0) / reviews.length).toFixed(1)) : null;
    return NextResponse.json({
      service,
      provider_profile: profileResult.data ?? null,
      provider_trust: {
        professional_buddy: Boolean((profileResult.data as any)?.is_professional_buddy),
        real_name_verified: Boolean((approvedIdentityResult.data ?? [])[0]?.id),
      },
      slots: slotsResult.data ?? [],
      reviews,
      review_summary: { count: reviews.length, average_rating: average },
      viewer: gate.viewer ? { user_id: gate.viewer.userId, email: gate.viewer.email } : null,
      build_tag: BUDDIES_BUILD_TAG,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "讀取服務詳情失敗。", build_tag: BUDDIES_BUILD_TAG }, { status: 500 });
  }
}
