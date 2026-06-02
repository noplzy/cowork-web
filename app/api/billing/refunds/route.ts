import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUserFromRequest } from "@/lib/serverRoomUtils";
import { FORMAL_OPS_BUILD_TAG, cleanText } from "@/lib/server/safety";

export const runtime = "nodejs";

type RefundBody = {
  payment_order_id?: string;
  amount_twd?: number | null;
  reason_category?: string;
  reason?: string;
};

const REASON_CATEGORIES = new Set(["duplicate_payment", "service_issue", "accidental_purchase", "fraud", "billing_error", "other"]);

function normalizeReasonCategory(input?: string) {
  const value = cleanText(input || "other", 60);
  return REASON_CATEGORIES.has(value) ? value : "other";
}

export async function GET(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const { data, error } = await supabaseAdmin
      .from("refund_requests")
      .select("id,payment_order_id,support_ticket_id,amount_twd,reason_category,reason,status,provider,provider_refund_id,requested_at,reviewed_at,resolved_at,created_at,updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(80);

    if (error) {
      return NextResponse.json({ error: error.message, build_tag: FORMAL_OPS_BUILD_TAG }, { status: 400 });
    }

    return NextResponse.json({ refunds: data ?? [], build_tag: FORMAL_OPS_BUILD_TAG });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "請先登入後再查看退款申請。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 401 });
    }
    return NextResponse.json({ error: error?.message || "讀取退款申請失敗。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await getAuthUserFromRequest(req);
    const body = (await req.json().catch(() => ({}))) as RefundBody;

    const paymentOrderId = cleanText(body.payment_order_id, 80);
    const reason = cleanText(body.reason, 6000);
    const reasonCategory = normalizeReasonCategory(body.reason_category);
    const amountTwd = Number.isFinite(Number(body.amount_twd)) ? Number(body.amount_twd) : null;

    if (!paymentOrderId) {
      return NextResponse.json({ error: "缺少 payment_order_id。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 400 });
    }
    if (!reason) {
      return NextResponse.json({ error: "請填寫退款原因。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 400 });
    }

    const order = await supabaseAdmin
      .from("payment_orders")
      .select("id,user_id,amount,status,merchant_trade_no")
      .eq("id", paymentOrderId)
      .eq("user_id", userId)
      .maybeSingle();

    if (order.error || !order.data) {
      return NextResponse.json({ error: order.error?.message || "找不到這筆付款。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 404 });
    }

    if (order.data.status !== "paid") {
      return NextResponse.json({ error: "只有已付款訂單可以申請退款。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 400 });
    }

    const ticket = await supabaseAdmin
      .from("support_tickets")
      .insert({
        user_id: userId,
        category: "refund",
        subject: `退款申請｜${order.data.merchant_trade_no}`,
        description: reason,
        status: "open",
        priority: "high",
        related_payment_order_id: order.data.id,
        metadata: { reason_category: reasonCategory },
        last_user_message_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (ticket.error || !ticket.data) {
      return NextResponse.json({ error: ticket.error?.message || "建立退款客服單失敗。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 400 });
    }

    const refund = await supabaseAdmin
      .from("refund_requests")
      .insert({
        user_id: userId,
        payment_order_id: order.data.id,
        support_ticket_id: ticket.data.id,
        amount_twd: amountTwd ?? order.data.amount,
        reason_category: reasonCategory,
        reason,
        status: "requested",
        provider: "ecpay",
      })
      .select("*")
      .single();

    if (refund.error || !refund.data) {
      return NextResponse.json({ error: refund.error?.message || "建立退款申請失敗。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 400 });
    }

    await supabaseAdmin.from("support_ticket_messages").insert({
      ticket_id: ticket.data.id,
      sender_user_id: userId,
      sender_role: "user",
      body: reason,
    });

    await supabaseAdmin.from("refund_events").insert({
      refund_request_id: refund.data.id,
      actor_user_id: userId,
      actor_role: "user",
      event_type: "refund_requested",
      metadata: { support_ticket_id: ticket.data.id },
    });

    return NextResponse.json({
      refund: refund.data,
      support_ticket: ticket.data,
      build_tag: FORMAL_OPS_BUILD_TAG,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "請先登入後再申請退款。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 401 });
    }
    return NextResponse.json({ error: error?.message || "建立退款申請失敗。", build_tag: FORMAL_OPS_BUILD_TAG }, { status: 500 });
  }
}
