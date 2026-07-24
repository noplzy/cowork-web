import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import {
  parseDailyRoomNameFromUrl,
  tryDeleteDailyRoom,
} from "@/lib/server/roomInfra";
import { P4A_BUILD_TAGS } from "@/lib/p4aStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ roomId: string }> };
type Body = {
  action?: "remove_member" | "end_room";
  target_user_id?: string | null;
  client_eject_confirmed?: boolean;
};

export async function POST(req: Request, context: Context) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { roomId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as Body;

    if (!body.action || !["remove_member", "end_room"].includes(body.action)) {
      return NextResponse.json(
        { error: "無效的房主操作。", build_tag: P4A_BUILD_TAGS.ownerControls },
        { status: 400 },
      );
    }
    if (body.action === "remove_member" && !body.target_user_id) {
      return NextResponse.json(
        { error: "缺少要移除的使用者。", build_tag: P4A_BUILD_TAGS.ownerControls },
        { status: 400 },
      );
    }

    const result = await supabaseAdmin.rpc("cowork_room_owner_action_v4a", {
      p_owner_user_id: userId,
      p_room_id: roomId,
      p_action: body.action,
      p_target_user_id: body.target_user_id || null,
      p_client_eject_confirmed: body.client_eject_confirmed === true,
    });
    if (result.error) {
      const message = result.error.message || "房主操作失敗。";
      const status = /NOT_ROOM_OWNER/i.test(message)
        ? 403
        : /ROOM_NOT_FOUND|TARGET_NOT_IN_ROOM/i.test(message)
          ? 404
          : 400;
      return NextResponse.json(
        { error: message, build_tag: P4A_BUILD_TAGS.ownerControls },
        { status },
      );
    }

    let dailyCleanup: Record<string, unknown> | null = null;
    if (body.action === "end_room") {
      const dailyRoomName = parseDailyRoomNameFromUrl(
        String((result.data as any)?.daily_room_url || ""),
      );
      dailyCleanup = dailyRoomName
        ? await tryDeleteDailyRoom(dailyRoomName)
        : { ok: true, skipped: true, reason: "missing_daily_room_name" };
    }

    return NextResponse.json({
      ok: true,
      result: result.data || {},
      daily_cleanup: dailyCleanup,
      build_tag: P4A_BUILD_TAGS.ownerControls,
    });
  } catch (error: any) {
    const status = error?.message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json(
      { error: error?.message || "房主操作失敗。", build_tag: P4A_BUILD_TAGS.ownerControls },
      { status },
    );
  }
}
