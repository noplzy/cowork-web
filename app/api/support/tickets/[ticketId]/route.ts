import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { FORMAL_OPS_BUILD_TAG, cleanText } from "@/lib/server/safety";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ ticketId: string }> };
type PatchBody = { action?: "close" | "reopen"; message?: string };

async function loadOwnTicket(ticketId: string, userId: string) {
  return supabaseAdmin
    .from("support_tickets")
    .select("*")
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
      return NextResponse.json({ error: ticket.error?.message || "找不到客服單。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 404 });
    }

    const [messages, events] = await Promise.all([
      supabaseAdmin
        .from("support_ticket_messages")
        .select("id,sender_user_id,sender_role,body,metadata,created_at")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("support_ticket_events")
        .select("id,actor_user_id,actor_role,event_type,from_status,to_status,metadata,created_at")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    return NextResponse.json({
      ticket: ticket.data,
      messages: messages.data ?? [],
      events: events.data ?? [],
      build_tag: FORMAL_OPS_BUILD_TAG,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "請先登入後再查看客服單。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 401 });
    }
    return NextResponse.json({ error: error?.message || "讀取客服單失敗。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { ticketId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as PatchBody;
    const action = body.action;

    if (!action || !["close", "reopen"].includes(action)) {
      return NextResponse.json({ error: "無效的客服單動作。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 400 });
    }

    const current = await loadOwnTicket(ticketId, userId);
    if (current.error || !current.data) {
      return NextResponse.json({ error: current.error?.message || "找不到客服單。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 404 });
    }

    const nextStatus = action === "close" ? "closed" : "open";
    const nowIso = new Date().toISOString();

    const update = await supabaseAdmin
      .from("support_tickets")
      .update({
        status: nextStatus,
        closed_at: action === "close" ? nowIso : null,
        updated_at: nowIso,
      })
      .eq("id", ticketId)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (update.error || !update.data) {
      return NextResponse.json({ error: update.error?.message || "更新客服單失敗。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 400 });
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
      event_type: action === "close" ? "ticket_closed_by_user" : "ticket_reopened_by_user",
      from_status: current.data.status,
      to_status: nextStatus,
    });

    return NextResponse.json({ ticket: update.data, build_tag: FORMAL_OPS_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "請先登入後再操作客服單。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 401 });
    }
    return NextResponse.json({ error: error?.message || "操作客服單失敗。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 500 });
  }
}
