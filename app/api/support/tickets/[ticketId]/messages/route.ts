import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { FORMAL_OPS_BUILD_TAG, cleanText } from "@/lib/server/safety";
import { assertSupportTransition } from "@/lib/server/trustOps";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ ticketId: string }> };
type Body = { body?: string };

export async function POST(req: Request, context: RouteContext) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { ticketId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as Body;
    const message = cleanText(body.body, 8000);
    if (!message) {
      return NextResponse.json(
        { error: "請填寫訊息內容。", build_tag: FORMAL_OPS_BUILD_TAG },
        { status: 400 },
      );
    }

    const ticket = await supabaseAdmin
      .from("support_tickets")
      .select("id,status")
      .eq("id", ticketId)
      .eq("user_id", userId)
      .maybeSingle();
    if (ticket.error || !ticket.data) {
      return NextResponse.json(
        { error: ticket.error?.message || "找不到客服單。", build_tag: FORMAL_OPS_BUILD_TAG },
        { status: 404 },
      );
    }
    if (ticket.data.status === "closed") {
      return NextResponse.json(
        { error: "這張客服單已關閉，請重新開啟或建立新的客服單。", build_tag: FORMAL_OPS_BUILD_TAG },
        { status: 400 },
      );
    }

    const inserted = await supabaseAdmin
      .from("support_ticket_messages")
      .insert({
        ticket_id: ticketId,
        sender_user_id: userId,
        sender_role: "user",
        body: message,
      })
      .select("id,ticket_id,sender_role,body,created_at")
      .single();
    if (inserted.error || !inserted.data) {
      return NextResponse.json(
        { error: inserted.error?.message || "新增訊息失敗。", build_tag: FORMAL_OPS_BUILD_TAG },
        { status: 400 },
      );
    }

    const nextStatus = ticket.data.status === "resolved" ? "open" : ticket.data.status;
    if (nextStatus !== ticket.data.status) {
      assertSupportTransition(ticket.data.status, nextStatus);
    }
    const nowIso = new Date().toISOString();
    const ticketPatch: Record<string, unknown> = {
      status: nextStatus,
      last_user_message_at: nowIso,
      updated_at: nowIso,
    };
    if (nextStatus === "open" && ticket.data.status === "resolved") {
      ticketPatch.resolved_at = null;
    }
    await supabaseAdmin
      .from("support_tickets")
      .update(ticketPatch)
      .eq("id", ticketId)
      .eq("user_id", userId);

    await supabaseAdmin.from("support_ticket_events").insert({
      ticket_id: ticketId,
      actor_user_id: userId,
      actor_role: "user",
      event_type: "user_message_added",
      from_status: ticket.data.status,
      to_status: nextStatus,
      metadata: { message_id: inserted.data.id, source: "account_support_v129" },
    });

    return NextResponse.json({ message: inserted.data, build_tag: FORMAL_OPS_BUILD_TAG });
  } catch (error: any) {
    const status = error?.message === "UNAUTHORIZED" ? 401 : Number(error?.status || 500);
    return NextResponse.json(
      { error: status === 401 ? "請先登入後再回覆客服單。" : error?.message || "新增客服訊息失敗。", code: error?.code, build_tag: FORMAL_OPS_BUILD_TAG },
      { status },
    );
  }
}
