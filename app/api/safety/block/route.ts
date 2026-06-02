import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { FORMAL_OPS_BUILD_TAG, cleanText } from "@/lib/server/safety";

export const runtime = "nodejs";

type Body = {
  blocked_user_id?: string;
  action?: "block" | "unblock";
  reason?: string | null;
};

export async function GET(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { data, error } = await supabaseAdmin
      .from("user_blocks")
      .select("id,blocked_user_id,reason,created_at")
      .eq("blocker_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: error.message, build_tag: FORMAL_OPS_BUILD_TAG }, { status: 400 });
    }

    return NextResponse.json({ blocks: data ?? [], build_tag: FORMAL_OPS_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "請先登入後再查看封鎖名單。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 401 });
    }
    return NextResponse.json({ error: error?.message || "讀取封鎖名單失敗。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const body = (await req.json().catch(() => ({}))) as Body;
    const targetUserId = cleanText(body.blocked_user_id, 80);
    const action = body.action || "block";
    const reason = cleanText(body.reason, 1000) || null;

    if (!targetUserId) {
      return NextResponse.json({ error: "缺少 blocked_user_id。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 400 });
    }
    if (targetUserId === userId) {
      return NextResponse.json({ error: "不能封鎖自己。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 400 });
    }

    if (action === "unblock") {
      const result = await supabaseAdmin
        .from("user_blocks")
        .delete()
        .eq("blocker_user_id", userId)
        .eq("blocked_user_id", targetUserId);

      if (result.error) {
        return NextResponse.json({ error: result.error.message, build_tag: FORMAL_OPS_BUILD_TAG }, { status: 400 });
      }

      return NextResponse.json({ ok: true, action: "unblock", build_tag: FORMAL_OPS_BUILD_TAG });
    }

    const result = await supabaseAdmin
      .from("user_blocks")
      .upsert(
        {
          blocker_user_id: userId,
          blocked_user_id: targetUserId,
          reason,
        },
        { onConflict: "blocker_user_id,blocked_user_id" }
      )
      .select("*")
      .single();

    if (result.error || !result.data) {
      return NextResponse.json({ error: result.error?.message || "封鎖失敗。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 400 });
    }

    return NextResponse.json({ block: result.data, build_tag: FORMAL_OPS_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "請先登入後再封鎖使用者。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 401 });
    }
    return NextResponse.json({ error: error?.message || "封鎖操作失敗。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 500 });
  }
}
