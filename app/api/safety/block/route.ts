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

function isMissingRelationshipBlockSchema(message?: string | null) {
  const text = String(message || "");
  return (
    /relation .*user_blocks.* does not exist/i.test(text) ||
    /column .*user_blocks\.(id|blocker_user_id|blocked_user_id|reason|created_at).* does not exist/i.test(text) ||
    /Could not find the '(id|blocker_user_id|blocked_user_id|reason|created_at)' column/i.test(text)
  );
}

function normalizeBlockRow(row: any) {
  const blocker = row?.blocker_user_id ?? "";
  const blocked = row?.blocked_user_id ?? "";

  return {
    id: row?.id ?? `${blocker}:${blocked}`,
    blocker_user_id: blocker,
    blocked_user_id: blocked,
    reason: row?.reason ?? null,
    created_at: row?.created_at ?? null,
  };
}

export async function GET(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);

    const { data, error } = await supabaseAdmin
      .from("user_blocks")
      .select("blocker_user_id,blocked_user_id,reason,created_at")
      .eq("blocker_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      if (isMissingRelationshipBlockSchema(error.message)) {
        return NextResponse.json({
          blocks: [],
          soft_error: error.message,
          build_tag: FORMAL_OPS_BUILD_TAG,
        });
      }

      return NextResponse.json({ error: error.message, build_tag: FORMAL_OPS_BUILD_TAG }, { status: 400 });
    }

    return NextResponse.json({ blocks: (data ?? []).map(normalizeBlockRow), build_tag: FORMAL_OPS_BUILD_TAG });
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

    const existing = await supabaseAdmin
      .from("user_blocks")
      .select("blocker_user_id,blocked_user_id,reason,created_at")
      .eq("blocker_user_id", userId)
      .eq("blocked_user_id", targetUserId)
      .maybeSingle();

    if (existing.error && isMissingRelationshipBlockSchema(existing.error.message)) {
      return NextResponse.json(
        {
          error: "封鎖功能的資料庫欄位尚未完整建立，請先套用 user_blocks schema alignment migration。",
          details: existing.error.message,
          build_tag: FORMAL_OPS_BUILD_TAG,
        },
        { status: 500 }
      );
    }

    if (existing.error) {
      return NextResponse.json({ error: existing.error.message, build_tag: FORMAL_OPS_BUILD_TAG }, { status: 400 });
    }

    const writeResult = existing.data
      ? await supabaseAdmin
          .from("user_blocks")
          .update({ reason })
          .eq("blocker_user_id", userId)
          .eq("blocked_user_id", targetUserId)
          .select("blocker_user_id,blocked_user_id,reason,created_at")
          .single()
      : await supabaseAdmin
          .from("user_blocks")
          .insert({ blocker_user_id: userId, blocked_user_id: targetUserId, reason })
          .select("blocker_user_id,blocked_user_id,reason,created_at")
          .single();

    if (writeResult.error || !writeResult.data) {
      return NextResponse.json({ error: writeResult.error?.message || "封鎖失敗。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 400 });
    }

    return NextResponse.json({ block: normalizeBlockRow(writeResult.data), build_tag: FORMAL_OPS_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "請先登入後再封鎖使用者。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 401 });
    }

    return NextResponse.json({ error: error?.message || "封鎖操作失敗。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 500 });
  }
}
