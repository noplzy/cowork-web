import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit } from "@/lib/server/adminAuth";
import { cleanText } from "@/lib/server/safety";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ ticketId: string }> };
type PatchBody = { status?: string; priority?: string; admin_message?: string; admin_note?: string };
const ALLOWED_STATUS = new Set(["open", "pending", "admin_review", "resolved", "closed"]);
const ALLOWED_PRIORITY = new Set(["low", "normal", "high", "urgent"]);

export async function GET(req: Request, context: RouteContext) {
  try {
    const admin = await getAdminUserFromRequest(req);
    const { ticketId } = await context.params;

    const [ticket, messages, events] = await Promise.all([
      supabaseAdmin.from("support_tickets").select("*").eq("id", ticketId).maybeSingle(),
      supabaseAdmin.from("support_ticket_messages").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
      supabaseAdmin.from("support_ticket_events").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: false }).limit(100),
    ]);

    if (ticket.error || !ticket.data) {
      return NextResponse.json({ error: ticket.error?.message || "找不到客服單。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 404 });
    }

    await writeAdminAudit(req, { adminUserId: admin.userId, actionType: "admin_support_ticket_viewed", targetType: "support_ticket", targetId: ticketId });
    return NextResponse.json({ ticket: ticket.data, messages: messages.data ?? [], events: events.data ?? [], build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const admin = await getAdminUserFromRequest(req);
    const { ticketId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as PatchBody;

    const current = await supabaseAdmin.from("support_tickets").select("*").eq("id", ticketId).maybeSingle();
    if (current.error || !current.data) {
      return NextResponse.json({ error: current.error?.message || "找不到客服單。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 404 });
    }

    const nextStatus = cleanText(body.status, 40);
    const nextPriority = cleanText(body.priority, 40);
    const adminMessage = cleanText(body.admin_message, 8000);
    const adminNote = cleanText(body.admin_note, 6000);

    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (nextStatus) {
      if (!ALLOWED_STATUS.has(nextStatus)) return NextResponse.json({ error: "無效的客服單狀態。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
      patch.status = nextStatus;
      if (nextStatus === "resolved") patch.resolved_at = new Date().toISOString();
      if (nextStatus === "closed") patch.closed_at = new Date().toISOString();
    }

    if (nextPriority) {
      if (!ALLOWED_PRIORITY.has(nextPriority)) return NextResponse.json({ error: "無效的客服單優先級。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
      patch.priority = nextPriority;
    }

    if (adminNote) patch.admin_note = adminNote;
    if (adminMessage) patch.last_admin_message_at = new Date().toISOString();

    const updated = await supabaseAdmin.from("support_tickets").update(patch).eq("id", ticketId).select("*").single();
    if (updated.error || !updated.data) {
      return NextResponse.json({ error: updated.error?.message || "更新客服單失敗。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    }

    if (adminMessage) {
      await supabaseAdmin.from("support_ticket_messages").insert({ ticket_id: ticketId, sender_user_id: admin.userId, sender_role: "admin", body: adminMessage });
    }

    await supabaseAdmin.from("support_ticket_events").insert({
      ticket_id: ticketId,
      actor_user_id: admin.userId,
      actor_role: "admin",
      event_type: "admin_ticket_updated",
      from_status: current.data.status,
      to_status: updated.data.status,
      metadata: { priority: updated.data.priority, has_admin_message: Boolean(adminMessage) },
    });

    await writeAdminAudit(req, {
      adminUserId: admin.userId,
      actionType: "admin_support_ticket_updated",
      targetType: "support_ticket",
      targetId: ticketId,
      metadata: { from_status: current.data.status, to_status: updated.data.status },
    });

    return NextResponse.json({ ticket: updated.data, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}
