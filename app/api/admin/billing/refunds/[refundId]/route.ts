import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_OPS_BUILD_TAG, adminErrorResponse, getAdminUserFromRequest, writeAdminAudit } from "@/lib/server/adminAuth";
import { cleanText } from "@/lib/server/safety";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ refundId: string }> };
type PatchBody = {
  status?: "reviewing" | "approved" | "rejected" | "processing" | "refunded" | "failed" | "cancelled";
  admin_note?: string;
  provider_refund_id?: string | null;
  manual_refund_confirmed?: boolean;
};

function envFlag(name: string) {
  return ["1", "true", "yes", "enabled"].includes(String(process.env[name] || "").trim().toLowerCase());
}

async function insertRefundLedgerIfMissing(refund: any, providerRefundId: string | null, adminUserId: string) {
  if (!refund?.payment_order_id) return null;

  const existing = await supabaseAdmin
    .from("billing_ledger")
    .select("id")
    .eq("payment_order_id", refund.payment_order_id)
    .eq("ledger_type", "refund")
    .limit(1)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data.id;

  const inserted = await supabaseAdmin
    .from("billing_ledger")
    .insert({
      user_id: refund.user_id,
      provider: "ecpay",
      ledger_type: "refund",
      direction: "debit",
      amount_twd: Number(refund.amount_twd || 0),
      currency: "TWD",
      payment_order_id: refund.payment_order_id,
      description: `退款：${refund.reason_category || "other"}`,
      occurred_at: new Date().toISOString(),
      metadata: {
        refund_request_id: refund.id,
        provider_refund_id: providerRefundId,
        manual_refund_confirmed: true,
        admin_user_id: adminUserId,
      },
    })
    .select("id")
    .single();
  if (inserted.error) throw inserted.error;
  return inserted.data?.id ?? null;
}

async function createInvoiceFollowupIfNeeded(refund: any, providerRefundId: string | null, adminUserId: string) {
  if (!refund?.payment_order_id) return null;

  const issued = await supabaseAdmin
    .from("invoice_events")
    .select("*")
    .eq("payment_order_id", refund.payment_order_id)
    .eq("event_type", "issued")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (issued.error) throw issued.error;
  if (!issued.data) return null;

  const existing = await supabaseAdmin
    .from("invoice_events")
    .select("id")
    .eq("payment_order_id", refund.payment_order_id)
    .eq("event_type", "void_or_allowance_required")
    .limit(1)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data.id;

  const inserted = await supabaseAdmin
    .from("invoice_events")
    .insert({
      user_id: refund.user_id,
      payment_order_id: refund.payment_order_id,
      provider: "ecpay_invoice",
      event_type: "void_or_allowance_required",
      invoice_number: issued.data.invoice_number,
      invoice_random_number: issued.data.invoice_random_number,
      metadata: {
        refund_request_id: refund.id,
        refund_amount_twd: refund.amount_twd,
        provider_refund_id: providerRefundId,
        admin_user_id: adminUserId,
        note: "退款已人工標記完成，需依開票日與退款情境確認發票作廢或折讓。",
      },
    })
    .select("id")
    .single();
  if (inserted.error) throw inserted.error;
  return inserted.data?.id ?? null;
}

async function ensureRefundTask(refund: any, adminUserId: string) {
  const existing = await supabaseAdmin
    .from("ecpay_refund_tasks")
    .select("*")
    .eq("refund_request_id", refund.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const liveEnabled = envFlag("ECPAY_REFUND_API_ENABLED");
  const endpoint = String(process.env.ECPAY_REFUND_ENDPOINT || "").trim();
  const inserted = await supabaseAdmin
    .from("ecpay_refund_tasks")
    .insert({
      refund_request_id: refund.id,
      payment_order_id: refund.payment_order_id,
      user_id: refund.user_id,
      status: liveEnabled && endpoint ? "queued" : "manual_required",
      provider_payload: {
        refund_request: refund,
        mode: liveEnabled && endpoint ? "live_endpoint_ready" : "manual_required",
        created_by_admin_user_id: adminUserId,
      },
    })
    .select("*")
    .single();
  if (inserted.error || !inserted.data) throw inserted.error || new Error("refund_task_insert_failed");
  return inserted.data;
}

async function markManualRefundTask(refund: any, providerRefundId: string | null, adminUserId: string) {
  const existing = await supabaseAdmin
    .from("ecpay_refund_tasks")
    .select("*")
    .eq("refund_request_id", refund.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.error) throw existing.error;

  if (existing.data) {
    const updated = await supabaseAdmin
      .from("ecpay_refund_tasks")
      .update({
        status: "refunded",
        provider_refund_id: providerRefundId,
        provider_payload: {
          ...(existing.data.provider_payload || {}),
          manual_refund_confirmed: true,
          admin_user_id: adminUserId,
        },
        last_error: null,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.data.id)
      .select("*")
      .single();
    if (updated.error) throw updated.error;
    return updated.data;
  }

  const inserted = await supabaseAdmin
    .from("ecpay_refund_tasks")
    .insert({
      refund_request_id: refund.id,
      payment_order_id: refund.payment_order_id,
      user_id: refund.user_id,
      status: "refunded",
      provider_refund_id: providerRefundId,
      provider_payload: {
        refund_request: refund,
        manual_refund_confirmed: true,
        admin_user_id: adminUserId,
      },
      processed_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (inserted.error || !inserted.data) throw inserted.error || new Error("manual_refund_task_insert_failed");
  return inserted.data;
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const admin = await getAdminUserFromRequest(req);
    const { refundId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as PatchBody;

    const current = await supabaseAdmin.from("refund_requests").select("*").eq("id", refundId).maybeSingle();
    if (current.error || !current.data) {
      return NextResponse.json({ error: current.error?.message || "找不到退款申請。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 404 });
    }

    if (!body.status) {
      return NextResponse.json({ error: "缺少退款狀態。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    }

    if (body.status === "refunded" && !body.provider_refund_id && !body.manual_refund_confirmed) {
      return NextResponse.json({
        error: "標記已退款需要 provider_refund_id，或明確傳入 manual_refund_confirmed=true。",
        build_tag: ADMIN_OPS_BUILD_TAG,
      }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const adminNote = cleanText(body.admin_note, 6000) || null;
    const providerRefundId = body.provider_refund_id ? cleanText(body.provider_refund_id, 120) : null;

    const patch: Record<string, any> = {
      status: body.status,
      admin_note: adminNote,
      reviewed_by_admin_user_id: admin.userId,
      reviewed_at: current.data.reviewed_at || nowIso,
      updated_at: nowIso,
    };

    if (["refunded", "rejected", "failed", "cancelled"].includes(body.status)) patch.resolved_at = nowIso;
    if (providerRefundId) patch.provider_refund_id = providerRefundId;

    const updated = await supabaseAdmin.from("refund_requests").update(patch).eq("id", refundId).select("*").single();
    if (updated.error || !updated.data) {
      return NextResponse.json({ error: updated.error?.message || "更新退款申請失敗。", build_tag: ADMIN_OPS_BUILD_TAG }, { status: 400 });
    }

    let task: any = null;
    let ledgerId: string | null = null;
    let invoiceFollowupId: string | null = null;

    if (["approved", "processing"].includes(updated.data.status)) {
      task = await ensureRefundTask(updated.data, admin.userId);
    }

    if (updated.data.status === "refunded") {
      task = await markManualRefundTask(updated.data, providerRefundId, admin.userId);
      ledgerId = await insertRefundLedgerIfMissing(updated.data, providerRefundId, admin.userId);
      invoiceFollowupId = await createInvoiceFollowupIfNeeded(updated.data, providerRefundId, admin.userId);
    }

    await supabaseAdmin.from("refund_events").insert({
      refund_request_id: refundId,
      actor_user_id: admin.userId,
      actor_role: "admin",
      event_type: `refund_${body.status}`,
      metadata: {
        from_status: current.data.status,
        to_status: updated.data.status,
        admin_note: adminNote,
        provider_refund_id: providerRefundId,
        task_id: task?.id ?? null,
        billing_ledger_id: ledgerId,
        invoice_followup_id: invoiceFollowupId,
      },
    });

    if (updated.data.support_ticket_id && ["approved", "processing", "refunded", "rejected", "failed", "cancelled"].includes(updated.data.status)) {
      await supabaseAdmin.from("support_tickets").update({
        status: updated.data.status === "refunded" ? "resolved" : "admin_review",
        updated_at: nowIso,
        admin_note: adminNote,
      }).eq("id", updated.data.support_ticket_id);
    }

    await writeAdminAudit(req, {
      adminUserId: admin.userId,
      actionType: "admin_refund_request_updated",
      targetType: "refund_request",
      targetId: refundId,
      metadata: { from_status: current.data.status, to_status: updated.data.status, task_id: task?.id ?? null },
    });

    return NextResponse.json({ refund: updated.data, refund_task: task, billing_ledger_id: ledgerId, invoice_followup_id: invoiceFollowupId, build_tag: ADMIN_OPS_BUILD_TAG });
  } catch (error: any) {
    const res = adminErrorResponse(error);
    return NextResponse.json(res.body, { status: res.status });
  }
}
