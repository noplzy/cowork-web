import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { HOST_CREDIT_BUILD_TAG, createAiHostSponsorPass } from "@/lib/server/hostCredit";

export const runtime = "nodejs";

type Context = { params: Promise<{ roomId: string }> };
type Body = { pass_type?: "ai_host"; duration_minutes?: number; benefited_user_ids?: string[]; metadata?: Record<string, unknown> };

export async function POST(req: Request, context: Context) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { roomId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as Body;

    const room = await supabaseAdmin.from("rooms").select("id,created_by,duration_minutes,status,ended_at").eq("id", roomId).maybeSingle();
    if (room.error || !room.data) return NextResponse.json({ error: room.error?.message || "找不到房間。", build_tag: HOST_CREDIT_BUILD_TAG }, { status: 404 });
    if (room.data.ended_at || room.data.status === "ended") return NextResponse.json({ error: "房間已結束，不能建立贊助通行證。", build_tag: HOST_CREDIT_BUILD_TAG }, { status: 410 });

    const membership = await supabaseAdmin.from("room_members").select("room_id,user_id").eq("room_id", roomId).eq("user_id", userId).maybeSingle();
    if (membership.error || (!membership.data && room.data.created_by !== userId)) return NextResponse.json({ error: "只有房間成員可以贊助 Shared Host。", build_tag: HOST_CREDIT_BUILD_TAG }, { status: 403 });
    if (body.pass_type && body.pass_type !== "ai_host") return NextResponse.json({ error: "目前只開放 AI 主持通行證 gate。", build_tag: HOST_CREDIT_BUILD_TAG }, { status: 400 });

    const result = await createAiHostSponsorPass({
      roomId,
      sponsorUserId: userId,
      durationMinutes: Number(body.duration_minutes || room.data.duration_minutes || 25),
      benefitedUserIds: body.benefited_user_ids ?? [],
      metadata: { source: "room_sponsor_pass_api", ...body.metadata },
    });

    return NextResponse.json({ sponsor_pass: result, build_tag: HOST_CREDIT_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "請先登入後再贊助 AI 主持。", build_tag: HOST_CREDIT_BUILD_TAG }, { status: 401 });
    const status = /INSUFFICIENT_HOST_CREDITS/.test(error?.message || "") ? 402 : 500;
    return NextResponse.json({ error: error?.message || "建立贊助通行證失敗。", build_tag: HOST_CREDIT_BUILD_TAG }, { status });
  }
}
