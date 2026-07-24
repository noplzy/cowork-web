import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { P4A_BUILD_TAGS } from "@/lib/p4aStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ roomId: string }> };
type Action = "send" | "accept" | "decline" | "cancel" | "remove";
type Body = {
  action?: Action;
  target_user_id?: string;
  message?: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIONS = new Set<Action>([
  "send",
  "accept",
  "decline",
  "cancel",
  "remove",
]);

export async function POST(req: Request, context: Context) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { roomId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as Body;
    const action = body.action;
    const targetUserId = String(body.target_user_id || "").trim();

    if (!action || !ACTIONS.has(action)) {
      return NextResponse.json(
        { error: "無效的好友操作。", build_tag: P4A_BUILD_TAGS.relationships },
        { status: 400 },
      );
    }
    if (!UUID_PATTERN.test(targetUserId)) {
      return NextResponse.json(
        { error: "缺少有效的目標使用者。", build_tag: P4A_BUILD_TAGS.relationships },
        { status: 400 },
      );
    }

    const result = await supabaseAdmin.rpc("cowork_room_friend_action_v4a", {
      p_actor_user_id: userId,
      p_target_user_id: targetUserId,
      p_room_id: roomId,
      p_action: action,
      p_message: String(body.message || "").trim().slice(0, 300) || null,
    });

    if (result.error) {
      const message = result.error.message || "好友操作失敗。";
      const status = /NOT_A_MEMBER|TARGET_NOT_IN_ROOM|RELATIONSHIP_UNAVAILABLE|FRIEND_REQUESTS_DISABLED/i.test(
        message,
      )
        ? 403
        : /FRIEND_REQUEST_NOT_FOUND|ROOM_NOT_FOUND/i.test(message)
          ? 404
          : 400;
      return NextResponse.json(
        { error: message, build_tag: P4A_BUILD_TAGS.relationships },
        { status },
      );
    }

    return NextResponse.json({
      relationship: result.data || {},
      build_tag: P4A_BUILD_TAGS.relationships,
    });
  } catch (error: any) {
    const status = error?.message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json(
      {
        error:
          status === 401 ? "請先登入後再操作好友關係。" : error?.message || "好友操作失敗。",
        build_tag: P4A_BUILD_TAGS.relationships,
      },
      { status },
    );
  }
}
