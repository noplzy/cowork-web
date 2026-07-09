import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { BUDDIES_BUILD_TAG } from "@/lib/buddies";
import { identityAccessErrorResponse, requireBuddiesRealNameVerifiedForRequest } from "@/lib/server/identityAccess";
export const runtime = "nodejs";
type Body = { display_title?: string; experience_summary?: string; service_boundaries?: string; submit?: boolean };

export async function GET(req: Request) {
  try {
    const { userId } = await requireBuddiesRealNameVerifiedForRequest(req);
    const result = await supabaseAdmin.from("buddy_provider_applications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(5);
    if (result.error) return NextResponse.json({ error: result.error.message, build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    return NextResponse.json({ applications: result.data ?? [], build_tag: BUDDIES_BUILD_TAG });
  } catch (error: any) {
    const mapped = identityAccessErrorResponse(error, BUDDIES_BUILD_TAG); if (mapped) return mapped;
    return NextResponse.json({ error: error?.message || "讀取申請失敗。", build_tag: BUDDIES_BUILD_TAG }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireBuddiesRealNameVerifiedForRequest(req);
    const body = (await req.json().catch(() => ({}))) as Body;
    const displayTitle = String(body.display_title || "").trim().slice(0, 80);
    const experienceSummary = String(body.experience_summary || "").trim().slice(0, 2000);
    const serviceBoundaries = String(body.service_boundaries || "").trim().slice(0, 2000);
    if (body.submit && (!displayTitle || !experienceSummary || !serviceBoundaries)) return NextResponse.json({ error: "送出申請前請補齊標題、經驗摘要與服務邊界。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    const pendingIdentity = await supabaseAdmin.from("identity_verification_requests").select("id,review_status").eq("user_id", userId).in("review_status", ["pending", "approved", "needs_more_info"]).order("created_at", { ascending: false }).limit(1);
    const existing = await supabaseAdmin.from("buddy_provider_applications").select("id").eq("user_id", userId).in("application_status", ["draft", "submitted", "needs_more_info"]).order("created_at", { ascending: false }).limit(1);
    if (existing.error) return NextResponse.json({ error: existing.error.message, build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    const payload = { user_id: userId, application_status: body.submit ? "submitted" : "draft", display_title: displayTitle || null, experience_summary: experienceSummary || null, service_boundaries: serviceBoundaries || null, identity_request_id: pendingIdentity.data?.[0]?.id ?? null, submitted_at: body.submit ? new Date().toISOString() : null, updated_at: new Date().toISOString(), metadata: { source: "buddies_provider_application_v118_identity_gated" } };
    const result = existing.data?.[0]?.id ? await supabaseAdmin.from("buddy_provider_applications").update(payload).eq("id", existing.data[0].id).select("*").single() : await supabaseAdmin.from("buddy_provider_applications").insert(payload).select("*").single();
    if (result.error || !result.data) return NextResponse.json({ error: result.error?.message || "儲存申請失敗。", build_tag: BUDDIES_BUILD_TAG }, { status: 400 });
    return NextResponse.json({ application: result.data, build_tag: BUDDIES_BUILD_TAG });
  } catch (error: any) {
    const mapped = identityAccessErrorResponse(error, BUDDIES_BUILD_TAG); if (mapped) return mapped;
    return NextResponse.json({ error: error?.message || "送出申請失敗。", build_tag: BUDDIES_BUILD_TAG }, { status: 500 });
  }
}
