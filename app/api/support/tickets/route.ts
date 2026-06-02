import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { FORMAL_OPS_BUILD_TAG, cleanText } from "@/lib/server/safety";

export const runtime = "nodejs";

type CreateTicketBody = {
  category?: string;
  subject?: string;
  description?: string;
  related_room_id?: string | null;
  related_booking_id?: string | null;
  related_payment_order_id?: string | null;
  metadata?: Record<string, unknown>;
};

const ALLOWED_CATEGORIES = new Set([
  "payment",
  "invoice",
  "room",
  "account",
  "safety",
  "buddies",
  "ai",
  "refund",
  "technical",
  "other",
]);

function normalizeCategory(input?: string) {
  const value = cleanText(input || "other", 40);
  return ALLOWED_CATEGORIES.has(value) ? value : "other";
}

export async function GET(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const url = new URL(req.url);
    const status = cleanText(url.searchParams.get("status") || "", 40);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 100);

    let query = supabaseAdmin
      .from("support_tickets")
      .select("id,category,subject,status,priority,related_room_id,related_booking_id,related_payment_order_id,last_user_message_at,last_admin_message_at,resolved_at,closed_at,created_at,updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message, build_tag: FORMAL_OPS_BUILD_TAG }, { status: 400 });
    }

    return NextResponse.json({ tickets: data ?? [], build_tag: FORMAL_OPS_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "請先登入後再查看客服紀錄。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 401 });
    }
    return NextResponse.json({ error: error?.message || "讀取客服紀錄失敗。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const body = (await req.json().catch(() => ({}))) as CreateTicketBody;

    const category = normalizeCategory(body.category);
    const subject = cleanText(body.subject, 160);
    const description = cleanText(body.description, 6000);

    if (subject.length < 4) {
      return NextResponse.json({ error: "請填寫至少 4 個字的主旨。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: "請填寫問題內容。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 400 });
    }

    const insert = await supabaseAdmin
      .from("support_tickets")
      .insert({
        user_id: userId,
        category,
        subject,
        description,
        status: "open",
        priority: category === "safety" || category === "payment" ? "high" : "normal",
        related_room_id: body.related_room_id || null,
        related_booking_id: body.related_booking_id || null,
        related_payment_order_id: body.related_payment_order_id || null,
        metadata: body.metadata ?? {},
        last_user_message_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (insert.error || !insert.data) {
      return NextResponse.json({ error: insert.error?.message || "建立客服單失敗。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 400 });
    }

    await supabaseAdmin.from("support_ticket_messages").insert({
      ticket_id: insert.data.id,
      sender_user_id: userId,
      sender_role: "user",
      body: description,
    });

    await supabaseAdmin.from("support_ticket_events").insert({
      ticket_id: insert.data.id,
      actor_user_id: userId,
      actor_role: "user",
      event_type: "ticket_created",
      to_status: "open",
      metadata: { category },
    });

    return NextResponse.json({ ticket: insert.data, build_tag: FORMAL_OPS_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "請先登入後再建立客服單。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 401 });
    }
    return NextResponse.json({ error: error?.message || "建立客服單失敗。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 500 });
  }
}
