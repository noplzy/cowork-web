import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { PROFILE_IDENTITY_BUILD_TAG, getAuthUserAdmin, maskEmail, maskPhone, syncVerifiedIdentityBindings } from "@/lib/server/profileIdentity";
export const runtime = "nodejs";
type Body = { action?: "submit_manual_review" | "cancel_pending_review"; legal_name?: string; birth_year?: number | string; document_type?: string; document_last4?: string; user_note?: string };

export async function GET(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const authUser = await getAuthUserAdmin(userId);
    await syncVerifiedIdentityBindings({ userId, email: authUser.email, phone: authUser.phone });
    const [bindings, requests] = await Promise.all([
      supabaseAdmin.from("user_identity_bindings").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabaseAdmin.from("identity_verification_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    ]);
    const firstError = bindings.error || requests.error;
    if (firstError) return NextResponse.json({ error: firstError.message, build_tag: PROFILE_IDENTITY_BUILD_TAG }, { status: 400 });
    return NextResponse.json({ auth: { email_masked: maskEmail(authUser.email), phone_masked: maskPhone(authUser.phone), email_verified: Boolean((authUser as any).email_confirmed_at || authUser.email), phone_verified: Boolean((authUser as any).phone_confirmed_at || authUser.phone) }, bindings: bindings.data ?? [], requests: requests.data ?? [], build_tag: PROFILE_IDENTITY_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "請先登入後再查看身分綁定。", build_tag: PROFILE_IDENTITY_BUILD_TAG }, { status: 401 });
    return NextResponse.json({ error: error?.message || "讀取身分綁定失敗。", build_tag: PROFILE_IDENTITY_BUILD_TAG }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const body = (await req.json().catch(() => ({}))) as Body;
    if ((body.action || "submit_manual_review") === "cancel_pending_review") {
      const result = await supabaseAdmin.from("identity_verification_requests").update({ review_status: "cancelled", updated_at: new Date().toISOString() }).eq("user_id", userId).eq("review_status", "pending").select("*");
      if (result.error) return NextResponse.json({ error: result.error.message, build_tag: PROFILE_IDENTITY_BUILD_TAG }, { status: 400 });
      return NextResponse.json({ requests: result.data ?? [], build_tag: PROFILE_IDENTITY_BUILD_TAG });
    }
    const legalName = String(body.legal_name || "").trim().slice(0, 80);
    const documentType = String(body.document_type || "id_card").trim().slice(0, 60);
    const documentLast4 = String(body.document_last4 || "").replace(/\D/g, "").slice(-4);
    const userNote = String(body.user_note || "").trim().slice(0, 1000) || null;
    const birthYear = Number(body.birth_year || 0);
    if (!legalName) return NextResponse.json({ error: "請填寫真實姓名。", build_tag: PROFILE_IDENTITY_BUILD_TAG }, { status: 400 });
    if (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > new Date().getFullYear()) return NextResponse.json({ error: "請填寫有效出生年份。", build_tag: PROFILE_IDENTITY_BUILD_TAG }, { status: 400 });
    if (documentLast4.length !== 4) return NextResponse.json({ error: "請填寫證件末四碼。正式文件影像上傳會在後續安全儲存流程開放。", build_tag: PROFILE_IDENTITY_BUILD_TAG }, { status: 400 });

    const pending = await supabaseAdmin.from("identity_verification_requests").select("id").eq("user_id", userId).in("review_status", ["pending", "needs_more_info"]).limit(1);
    if (pending.error) return NextResponse.json({ error: pending.error.message, build_tag: PROFILE_IDENTITY_BUILD_TAG }, { status: 400 });
    if ((pending.data ?? []).length > 0) return NextResponse.json({ error: "已有待審核的身分申請。", build_tag: PROFILE_IDENTITY_BUILD_TAG }, { status: 409 });

    const inserted = await supabaseAdmin.from("identity_verification_requests").insert({ user_id: userId, request_type: "manual_review", legal_name: legalName, birth_year: birthYear, document_type: documentType, document_last4: documentLast4, review_status: "pending", user_note: userNote, metadata: { source: "account_identity_bindings_v114" } }).select("*").single();
    if (inserted.error || !inserted.data) return NextResponse.json({ error: inserted.error?.message || "送出身分申請失敗。", build_tag: PROFILE_IDENTITY_BUILD_TAG }, { status: 400 });
    await supabaseAdmin.from("user_identity_bindings").insert({ user_id: userId, binding_type: "manual_review", binding_value_masked: `document-***${documentLast4}`, status: "pending", source: "manual_review", metadata: { identity_request_id: inserted.data.id, document_type: documentType } });
    return NextResponse.json({ request: inserted.data, build_tag: PROFILE_IDENTITY_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "請先登入後再送出身分申請。", build_tag: PROFILE_IDENTITY_BUILD_TAG }, { status: 401 });
    return NextResponse.json({ error: error?.message || "送出身分申請失敗。", build_tag: PROFILE_IDENTITY_BUILD_TAG }, { status: 500 });
  }
}
