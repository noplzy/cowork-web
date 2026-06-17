import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { PROFILE_IDENTITY_BUILD_TAG, ensurePrivateSettings, ensureProfileForUser, getAuthUserAdmin, normalizeProfilePatch } from "@/lib/server/profileIdentity";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const authUser = await getAuthUserAdmin(userId);
    const [profile, settings] = await Promise.all([
      ensureProfileForUser({ id: authUser.id, email: authUser.email, user_metadata: (authUser as any).user_metadata ?? null }),
      ensurePrivateSettings(userId),
    ]);
    return NextResponse.json({ profile, settings, auth: { email: authUser.email ?? null, phone: authUser.phone ?? null, email_confirmed_at: (authUser as any).email_confirmed_at ?? null, phone_confirmed_at: (authUser as any).phone_confirmed_at ?? null }, build_tag: PROFILE_IDENTITY_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "請先登入後再查看個人檔案。", build_tag: PROFILE_IDENTITY_BUILD_TAG }, { status: 401 });
    return NextResponse.json({ error: error?.message || "讀取個人檔案失敗。", build_tag: PROFILE_IDENTITY_BUILD_TAG }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const patch = normalizeProfilePatch(body);
    const existingHandle = await supabaseAdmin.from("profiles").select("user_id").eq("handle", patch.handle).neq("user_id", userId).maybeSingle();
    if (existingHandle.error) return NextResponse.json({ error: existingHandle.error.message, build_tag: PROFILE_IDENTITY_BUILD_TAG }, { status: 400 });
    if (existingHandle.data) return NextResponse.json({ error: "這個個人代號已被使用。", build_tag: PROFILE_IDENTITY_BUILD_TAG }, { status: 409 });

    const updated = await supabaseAdmin.from("profiles").upsert({ user_id: userId, ...patch }, { onConflict: "user_id" }).select("*").single();
    if (updated.error || !updated.data) return NextResponse.json({ error: updated.error?.message || "更新個人檔案失敗。", build_tag: PROFILE_IDENTITY_BUILD_TAG }, { status: 400 });

    const settings = await supabaseAdmin.from("user_private_profile_settings").upsert({
      user_id: userId,
      notify_friend_requests: body.notify_friend_requests !== false,
      notify_schedule_updates: body.notify_schedule_updates !== false,
      notify_room_reminders: body.notify_room_reminders !== false,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" }).select("*").single();

    return NextResponse.json({ profile: updated.data, settings: settings.data ?? null, build_tag: PROFILE_IDENTITY_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "請先登入後再更新個人檔案。", build_tag: PROFILE_IDENTITY_BUILD_TAG }, { status: 401 });
    return NextResponse.json({ error: error?.message || "更新個人檔案失敗。", build_tag: PROFILE_IDENTITY_BUILD_TAG }, { status: 500 });
  }
}
