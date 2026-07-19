import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { FORMAL_OPS_BUILD_TAG, cleanText } from "@/lib/server/safety";
import { assertSupportTransition } from "@/lib/server/trustOps";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ ticketId: string }> };
type PatchBody = { action?: "close" | "reopen"; message?: string };

const USER_TICKET_FIELDS =
  "id,user_id,category,subject,description,status,priority,related_room_id,related_booking_id,related_payment_order_id,last_user_message_at,last_admin_message_at,resolved_at,closed_at,created_at,updated_at";

async function loadOwnTicket(ticketId: string, userId: string) {
  return supabaseAdmin
    .from("support_tickets")
    .select(USER_TICKET_FIELDS)
    .eq("id", ticketId)
    .eq("user_id", userId)
    .maybeSingle();
}

export async function GET(req: Request, context: RouteContext) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { ticketId } = await context.params;
    const ticket = await loadOwnTicket(ticketId, userId);
    if (ticket.error || !ticket.data) {
      return NextResponse.json(
        { error: ticket.error?.message || "找不到客服單。", build_tag: FORMAL_OPS_BUILD_TAG },
        { status: 404 },
      );
    }

    const [messages, events] = await Promise.all([
      supabaseAdmin
        .from("support_ticket_messages")
        .select("id,ticket_id,sender_role,body,created_at")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("support_ticket_events")
        .select("id,ticket_id,actor_role,event_type,from_status,to_status,created_at")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false })
        .limit(80),
    ]);
    if (messages.error) throw messages.error;
    if (events.error) throw events.error;

    return NextResponse.json({
      ticket: ticket.data,
      messages: messages.data ?? [],
      events: events.data ?? [],
      build_tag: FORMAL_OPS_BUILD_TAG,
    });
  } catch (error: any) {
    const status = error?.message === "UNAUTHORIZED" ? 401 : Number(error?.status || 500);
    return NextResponse.json(
      { error: status === 401 ? "請先登入後再查看客服單。" : error?.message || "讀取客服單失敗。", build_tag: FORMAL_OPS_BUILD_TAG },
      { status },
    );
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { ticketId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as PatchBody;
    if (!body.action || !["close", "reopen"].includes(body.action)) {
      return NextResponse.json(
        { error: "無效的客服單動作。", build_tag: FORMAL_OPS_BUILD_TAG },
        { status: 400 },
      );
    }

    const current = await loadOwnTicket(ticketId, userId);
    if (current.error || !current.data) {
      return NextResponse.json(
        { error: current.error?.message || "找不到客服單。", build_tag: FORMAL_OPS_BUILD_TAG },
        { status: 404 },
      );
    }

    const nextStatus = body.action === "close" ? "closed" : "open";
    assertSupportTransition(current.data.status, nextStatus);
    const nowIso = new Date().toISOString();
    const update = await supabaseAdmin
      .from("support_tickets")
      .update({
        status: nextStatus,
        resolved_at: nextStatus === "open" ? null : current.data.resolved_at,
        closed_at: nextStatus === "closed" ? nowIso : null,
        updated_at: nowIso,
      })
      .eq("id", ticketId)
      .eq("user_id", userId)
      .select(USER_TICKET_FIELDS)
      .single();
    if (update.error || !update.data) {
      return NextResponse.json(
        { error: update.error?.message || "更新客服單失敗。", build_tag: FORMAL_OPS_BUILD_TAG },
        { status: 400 },
      );
    }

    const message = cleanText(body.message, 4000);
    if (message) {
      await supabaseAdmin.from("support_ticket_messages").insert({
        ticket_id: ticketId,
        sender_user_id: userId,
        sender_role: "user",
        body: message,
      });
    }
    await supabaseAdmin.from("support_ticket_events").insert({
      ticket_id: ticketId,
      actor_user_id: userId,
      actor_role: "user",
      event_type: body.action === "close" ? "ticket_closed_by_user" : "ticket_reopened_by_user",
      from_status: current.data.status,
      to_status: nextStatus,
      metadata: { has_message: Boolean(message), source: "account_support_v129" },
    });

    return NextResponse.json({ ticket: update.data, build_tag: FORMAL_OPS_BUILD_TAG });
  } catch (error: any) {
    const status = error?.message === "UNAUTHORIZED" ? 401 : Number(error?.status || 500);
    return NextResponse.json(
      { error: status === 401 ? "請先登入後再操作客服單。" : error?.message || "操作客服單失敗。", code: error?.code, build_tag: FORMAL_OPS_BUILD_TAG },
      { status },
    );
  }
}
