import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { APPEALS_BUILD_TAG } from "@/lib/server/appeals";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const [actions, cases] = await Promise.all([
      supabaseAdmin
        .from("moderation_actions")
        .select("id,case_id,action_type,reason,starts_at,expires_at,created_at,metadata")
        .eq("target_user_id", userId)
        .not("action_type", "in", "(restore,note)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("moderation_cases")
        .select("id,status,severity,summary,created_at,updated_at,closed_at")
        .eq("target_user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(100),
    ]);
    if (actions.error) throw actions.error;
    if (cases.error) throw cases.error;
    return NextResponse.json({
      actions: actions.data ?? [],
      cases: cases.data ?? [],
      build_tag: APPEALS_BUILD_TAG,
    });
  } catch (error: any) {
    const status = error?.message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json(
      { error: status === 401 ? "請先登入。" : error?.message || "讀取治理紀錄失敗。", build_tag: APPEALS_BUILD_TAG },
      { status },
    );
  }
}
