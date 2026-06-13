import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const BILLING_AUTOMATION_BUILD_TAG = "billing-automation-v116-2026-06-13";

const INVOICE_TERMINAL_STATUSES = new Set(["issued", "completed", "voided", "allowance_issued", "cancelled"]);
const REFUND_TERMINAL_STATUSES = new Set(["refunded", "completed", "cancelled"]);
const PROVIDER_PROCESSABLE_STATUSES = new Set(["queued", "failed", "manual_required"]);

function envFlag(name: string) {
  return ["1", "true", "yes", "enabled"].includes(String(process.env[name] || "").trim().toLowerCase());
}

export function verifyBillingAutomationSecret(req: Request) {
  const expected = process.env.BILLING_AUTOMATION_SECRET || process.env.ROOM_CLEANUP_SECRET || process.env.CRON_SECRET;
  if (!expected) throw new Error("Missing BILLING_AUTOMATION_SECRET / ROOM_CLEANUP_SECRET / CRON_SECRET");

  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";
  const got =
    req.headers.get("x-cron-secret") ||
    req.headers.get("x-internal-secret") ||
    new URL(req.url).searchParams.get("secret") ||
    bearer;

  if (got !== expected) throw Object.assign(new Error("UNAUTHORIZED_BILLING_AUTOMATION"), { status: 401 });
}

function getAdapterSecret() {
  return process.env.ECPAY_ADAPTER_SECRET || process.env.BILLING_AUTOMATION_SECRET || process.env.ROOM_CLEANUP_SECRET || process.env.CRON_SECRET || "";
}

async function postJson(endpoint: string, payload: Record<string, unknown>) {
  const adapterSecret = getAdapterSecret();
  if (!adapterSecret) throw new Error("Missing ECPAY_ADAPTER_SECRET / BILLING_AUTOMATION_SECRET for provider adapter call");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-calmco-billing-build": BILLING_AUTOMATION_BUILD_TAG,
      "x-internal-secret": adapterSecret,
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`provider_http_${response.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function insertIfMissing(input: { table: string; filters: Record<string, string | null | undefined>; row: Record<string, unknown> }) {
  let query = supabaseAdmin.from(input.table).select("id").limit(1);
  for (const [key, value] of Object.entries(input.filters)) {
    if (value === null || value === undefined) query = query.is(key, null);
    else query = query.eq(key, value);
  }

  const existing = await query.maybeSingle();
  if (existing.error && !/relation .* does not exist/i.test(existing.error.message)) throw existing.error;
  if (existing.data) return { inserted: false, id: existing.data.id };

  const inserted = await supabaseAdmin.from(input.table).insert(input.row).select("id").single();
  if (inserted.error) {
    if (/duplicate key/i.test(inserted.error.message)) return { inserted: false, id: null };
    if (/relation .* does not exist/i.test(inserted.error.message)) return { inserted: false, id: null, skipped: true };
    throw inserted.error;
  }

  return { inserted: true, id: inserted.data?.id ?? null };
}

function extractInvoiceNumber(providerResult: any) {
  return (
    providerResult?.invoice_number ??
    providerResult?.InvoiceNo ??
    providerResult?.InvoiceNumber ??
    providerResult?.invoiceNo ??
    null
  );
}

function extractInvoiceRandomNumber(providerResult: any) {
  return (
    providerResult?.random_number ??
    providerResult?.RandomNumber ??
    providerResult?.RandomNum ??
    providerResult?.RtnRandomNumber ??
    null
  );
}

function extractProviderRefundId(providerResult: any) {
  return providerResult?.refund_id ?? providerResult?.TradeNo ?? providerResult?.provider_refund_id ?? null;
}

function invoiceActionFromEvent(invoice: any) {
  const eventType = String(invoice?.event_type || "");
  if (eventType === "requested") return "issue";
  if (eventType === "void_or_allowance_required") return "void_or_allowance";
  if (eventType === "void_requested") return "void";
  if (eventType === "allowance_requested") return "allowance";
  return "manual_review";
}

function normalizeFollowupResultEvent(providerResult: any, actionType: string) {
  const raw = String(providerResult?.invoice_event_type || providerResult?.event_type || providerResult?.status || "").trim();
  if (["voided", "allowance_issued", "void_or_allowance_completed"].includes(raw)) return raw;
  if (actionType === "void") return "voided";
  if (actionType === "allowance") return "allowance_issued";
  return "void_or_allowance_completed";
}

function buildInvoiceAdapterPayload(task: any, invoice: any, actionType: string) {
  const order = invoice?.payment_orders || {};
  const common = {
    contract_version: "calmco-ecpay-invoice-adapter-v2",
    build_tag: BILLING_AUTOMATION_BUILD_TAG,
    action_type: actionType,
    task: {
      id: task.id,
      invoice_event_id: task.invoice_event_id,
      payment_order_id: task.payment_order_id,
      refund_request_id: task.refund_request_id ?? invoice.metadata?.refund_request_id ?? null,
      user_id: task.user_id,
      attempt_count: Number(task.attempt_count || 0),
      action_type: actionType,
    },
    invoice_event: invoice,
    payment_order: order,
  };

  if (actionType === "issue") {
    return {
      ...common,
      invoice_request: {
        provider: "ecpay_invoice",
        relate_number: order.merchant_trade_no || invoice.id,
        merchant_trade_no: order.merchant_trade_no || null,
        buyer_user_id: invoice.user_id || order.user_id || null,
        buyer_email: order.metadata?.customer_email || order.provider_payload?.customer_email || null,
        item_name: invoice.metadata?.item_name || order.invoice_item_name || order.item_name || order.trade_desc || "安感島服務費",
        sales_amount: Number(invoice.metadata?.amount ?? order.amount ?? 0),
        currency: order.currency || "TWD",
        tax_mode: "tax_included",
        source: "payment_order_paid",
      },
    };
  }

  return {
    ...common,
    invoice_followup_request: {
      provider: "ecpay_invoice",
      original_invoice_number: invoice.invoice_number || invoice.metadata?.invoice_number || null,
      original_invoice_random_number: invoice.invoice_random_number || invoice.metadata?.invoice_random_number || null,
      refund_request_id: invoice.metadata?.refund_request_id || task.refund_request_id || null,
      refund_amount_twd: Number(invoice.metadata?.refund_amount_twd || 0),
      recommended_action: actionType,
      note: invoice.metadata?.note || "退款已完成，需依開票日與退款情境確認發票作廢或折讓。",
    },
  };
}

async function paymentOrderHasIssuedInvoice(paymentOrderId?: string | null) {
  if (!paymentOrderId) return false;
  const issued = await supabaseAdmin
    .from("invoice_events")
    .select("id")
    .eq("payment_order_id", paymentOrderId)
    .eq("event_type", "issued")
    .limit(1)
    .maybeSingle();
  if (issued.error) throw issued.error;
  return !!issued.data;
}

async function getOrCreateInvoiceTask(invoice: any, liveEnabled: boolean, endpoint: string, actionType: string) {
  let query = supabaseAdmin
    .from("ecpay_invoice_tasks")
    .select("*")
    .eq("invoice_event_id", invoice.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (actionType) query = query.eq("action_type", actionType);

  const existing = await query.maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return { task: existing.data, created: false };

  const inserted = await supabaseAdmin
    .from("ecpay_invoice_tasks")
    .insert({
      invoice_event_id: invoice.id,
      payment_order_id: invoice.payment_order_id,
      refund_request_id: invoice.metadata?.refund_request_id ?? null,
      user_id: invoice.user_id,
      action_type: actionType,
      status: liveEnabled && endpoint ? "queued" : "manual_required",
      provider_invoice_no: invoice.invoice_number ?? null,
      provider_random_number: invoice.invoice_random_number ?? null,
      provider_payload: {
        invoice_event: invoice,
        mode: liveEnabled && endpoint ? "live_endpoint_ready" : "manual_required",
        action_type: actionType,
        build_tag: BILLING_AUTOMATION_BUILD_TAG,
      },
    })
    .select("*")
    .single();
  if (inserted.error || !inserted.data) throw inserted.error || new Error("invoice_task_insert_failed");
  return { task: inserted.data, created: true };
}

async function markInvoiceTaskManual(task: any, reason: string) {
  await supabaseAdmin
    .from("ecpay_invoice_tasks")
    .update({
      status: "manual_required",
      last_error: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", task.id);
}

async function recordInvoiceFailedEvent(invoice: any, task: any, message: string) {
  await supabaseAdmin.from("invoice_events").insert({
    user_id: invoice.user_id,
    payment_order_id: invoice.payment_order_id,
    provider: "ecpay_invoice",
    event_type: "failed",
    invoice_number: invoice.invoice_number ?? null,
    invoice_random_number: invoice.invoice_random_number ?? null,
    metadata: {
      task_id: task.id,
      action_type: task.action_type || invoiceActionFromEvent(invoice),
      message,
      build_tag: BILLING_AUTOMATION_BUILD_TAG,
    },
  });
}

export async function processInvoiceTasks(limit = 20) {
  const liveEnabled = envFlag("ECPAY_INVOICE_API_ENABLED");
  const endpoint = String(process.env.ECPAY_INVOICE_ENDPOINT || "").trim();
  const pending = await supabaseAdmin
    .from("invoice_events")
    .select("*, payment_orders(*)")
    .in("event_type", ["requested", "void_or_allowance_required", "void_requested", "allowance_requested"])
    .order("created_at", { ascending: true })
    .limit(limit);
  if (pending.error) throw pending.error;
  const results: any[] = [];

  for (const invoice of pending.data ?? []) {
    const actionType = invoiceActionFromEvent(invoice);

    if (actionType === "issue" && (await paymentOrderHasIssuedInvoice(invoice.payment_order_id))) {
      results.push({ invoice_event_id: invoice.id, skipped: true, reason: "already_issued_for_payment_order" });
      continue;
    }

    let task: any;
    try {
      task = (await getOrCreateInvoiceTask(invoice, liveEnabled, endpoint, actionType)).task;
    } catch (error: any) {
      results.push({ invoice_event_id: invoice.id, error: error?.message || "task_prepare_failed" });
      continue;
    }

    if (INVOICE_TERMINAL_STATUSES.has(String(task.status || ""))) {
      results.push({ invoice_event_id: invoice.id, task_id: task.id, skipped: true, reason: `terminal_${task.status}` });
      continue;
    }

    if (!liveEnabled || !endpoint) {
      await markInvoiceTaskManual(task, "ECPAY_INVOICE_API_ENABLED / ECPAY_INVOICE_ENDPOINT not enabled");
      results.push({ invoice_event_id: invoice.id, task_id: task.id, status: "manual_required", action_type: actionType });
      continue;
    }

    if (!PROVIDER_PROCESSABLE_STATUSES.has(String(task.status || ""))) {
      results.push({ invoice_event_id: invoice.id, task_id: task.id, skipped: true, reason: `status_${task.status}` });
      continue;
    }

    await supabaseAdmin
      .from("ecpay_invoice_tasks")
      .update({ status: "processing", attempt_count: Number(task.attempt_count || 0) + 1, updated_at: new Date().toISOString() })
      .eq("id", task.id);

    try {
      const providerResult = await postJson(endpoint, buildInvoiceAdapterPayload(task, invoice, actionType));

      if (actionType === "issue") {
        const invoiceNumber = extractInvoiceNumber(providerResult);
        const randomNumber = extractInvoiceRandomNumber(providerResult);
        const issuedAt = providerResult.issued_at || providerResult.IssueDate || new Date().toISOString();

        if (!invoiceNumber) throw new Error("provider_missing_invoice_number");

        await supabaseAdmin
          .from("ecpay_invoice_tasks")
          .update({
            status: "issued",
            provider_invoice_no: invoiceNumber,
            provider_random_number: randomNumber,
            provider_payload: providerResult,
            last_error: null,
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", task.id);

        if (!(await paymentOrderHasIssuedInvoice(invoice.payment_order_id))) {
          await supabaseAdmin.from("invoice_events").insert({
            user_id: invoice.user_id,
            payment_order_id: invoice.payment_order_id,
            provider: "ecpay_invoice",
            event_type: "issued",
            invoice_number: invoiceNumber,
            invoice_random_number: randomNumber,
            issued_at: issuedAt,
            metadata: { task_id: task.id, provider_result: providerResult, build_tag: BILLING_AUTOMATION_BUILD_TAG },
          });
        }

        results.push({ invoice_event_id: invoice.id, task_id: task.id, status: "issued", invoice_number: invoiceNumber });
      } else {
        const requestedManual = String(providerResult?.status || providerResult?.event_type || "").trim() === "manual_required" || providerResult?.manual_required === true;
        if (requestedManual) {
          const reason = providerResult?.reason || providerResult?.message || "provider_requested_manual_review";
          await supabaseAdmin
            .from("ecpay_invoice_tasks")
            .update({
              status: "manual_required",
              provider_payload: providerResult,
              last_error: reason,
              updated_at: new Date().toISOString(),
            })
            .eq("id", task.id);

          await supabaseAdmin.from("invoice_events").insert({
            user_id: invoice.user_id,
            payment_order_id: invoice.payment_order_id,
            provider: "ecpay_invoice",
            event_type: "manual_required",
            invoice_number: invoice.invoice_number || null,
            invoice_random_number: invoice.invoice_random_number || null,
            metadata: {
              task_id: task.id,
              source_invoice_event_id: invoice.id,
              action_type: actionType,
              refund_request_id: task.refund_request_id ?? invoice.metadata?.refund_request_id ?? null,
              provider_result: providerResult,
              build_tag: BILLING_AUTOMATION_BUILD_TAG,
            },
          });

          results.push({ invoice_event_id: invoice.id, task_id: task.id, status: "manual_required", action_type: actionType, reason });
          continue;
        }

        const followupEvent = normalizeFollowupResultEvent(providerResult, actionType);
        const invoiceNumber = extractInvoiceNumber(providerResult) || invoice.invoice_number || null;
        const randomNumber = extractInvoiceRandomNumber(providerResult) || invoice.invoice_random_number || null;

        await supabaseAdmin
          .from("ecpay_invoice_tasks")
          .update({
            status: followupEvent === "voided" || followupEvent === "allowance_issued" ? followupEvent : "completed",
            provider_invoice_no: invoiceNumber,
            provider_random_number: randomNumber,
            provider_task_id: providerResult.task_id ?? providerResult.TradeNo ?? providerResult.allowance_number ?? null,
            provider_payload: providerResult,
            last_error: null,
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", task.id);

        await supabaseAdmin.from("invoice_events").insert({
          user_id: invoice.user_id,
          payment_order_id: invoice.payment_order_id,
          provider: "ecpay_invoice",
          event_type: followupEvent,
          invoice_number: invoiceNumber,
          invoice_random_number: randomNumber,
          issued_at: providerResult.processed_at || providerResult.IssueDate || providerResult.IA_Date || new Date().toISOString(),
          metadata: {
            task_id: task.id,
            source_invoice_event_id: invoice.id,
            action_type: actionType,
            refund_request_id: task.refund_request_id ?? invoice.metadata?.refund_request_id ?? null,
            provider_result: providerResult,
            build_tag: BILLING_AUTOMATION_BUILD_TAG,
          },
        });

        results.push({ invoice_event_id: invoice.id, task_id: task.id, status: followupEvent, action_type: actionType });
      }
    } catch (error: any) {
      const message = error?.message || "provider_error";
      await supabaseAdmin
        .from("ecpay_invoice_tasks")
        .update({ status: "failed", last_error: message, updated_at: new Date().toISOString() })
        .eq("id", task.id);
      await recordInvoiceFailedEvent(invoice, task, message);
      results.push({ invoice_event_id: invoice.id, task_id: task.id, error: message });
    }
  }
  return results;
}

async function getOrCreateRefundTask(refund: any, liveEnabled: boolean, endpoint: string) {
  const existing = await supabaseAdmin
    .from("ecpay_refund_tasks")
    .select("*")
    .eq("refund_request_id", refund.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return { task: existing.data, created: false };

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
        build_tag: BILLING_AUTOMATION_BUILD_TAG,
      },
    })
    .select("*")
    .single();
  if (inserted.error || !inserted.data) throw inserted.error || new Error("refund_task_insert_failed");
  return { task: inserted.data, created: true };
}

async function recordRefundLedger(refund: any, providerResult: any) {
  if (!refund?.id || !refund?.user_id || !refund?.payment_order_id) return;
  await insertIfMissing({
    table: "billing_ledger",
    filters: { payment_order_id: refund.payment_order_id, ledger_type: "refund" },
    row: {
      user_id: refund.user_id,
      provider: "ecpay",
      ledger_type: "refund",
      direction: "debit",
      amount_twd: Number(refund.amount_twd || refund.payment_orders?.amount || 0),
      currency: refund.payment_orders?.currency || "TWD",
      payment_order_id: refund.payment_order_id,
      description: `退款：${refund.reason_category || "other"}`,
      occurred_at: new Date().toISOString(),
      metadata: {
        refund_request_id: refund.id,
        provider_refund_id: extractProviderRefundId(providerResult),
        provider_result: providerResult,
        build_tag: BILLING_AUTOMATION_BUILD_TAG,
      },
    },
  });
}

async function requestInvoiceVoidOrAllowanceIfNeeded(refund: any, providerResult: any) {
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
        provider_result: providerResult,
        note: "退款已完成，需依開票日與退款情境人工確認作廢或折讓。",
        build_tag: BILLING_AUTOMATION_BUILD_TAG,
      },
    })
    .select("id")
    .single();
  if (inserted.error) throw inserted.error;
  return inserted.data?.id ?? null;
}

export async function processRefundTasks(limit = 20) {
  const liveEnabled = envFlag("ECPAY_REFUND_API_ENABLED");
  const endpoint = String(process.env.ECPAY_REFUND_ENDPOINT || "").trim();
  const pending = await supabaseAdmin
    .from("refund_requests")
    .select("*, payment_orders(*)")
    .in("status", ["approved", "processing"])
    .order("created_at", { ascending: true })
    .limit(limit);
  if (pending.error) throw pending.error;
  const results: any[] = [];

  for (const refund of pending.data ?? []) {
    let task: any;
    try {
      task = (await getOrCreateRefundTask(refund, liveEnabled, endpoint)).task;
    } catch (error: any) {
      results.push({ refund_request_id: refund.id, error: error?.message || "task_prepare_failed" });
      continue;
    }

    if (REFUND_TERMINAL_STATUSES.has(String(task.status || ""))) {
      results.push({ refund_request_id: refund.id, task_id: task.id, skipped: true, reason: `terminal_${task.status}` });
      continue;
    }

    if (!liveEnabled || !endpoint) {
      await supabaseAdmin
        .from("ecpay_refund_tasks")
        .update({ status: "manual_required", last_error: "ECPAY_REFUND_API_ENABLED / ECPAY_REFUND_ENDPOINT not enabled", updated_at: new Date().toISOString() })
        .eq("id", task.id);
      results.push({ refund_request_id: refund.id, task_id: task.id, status: "manual_required" });
      continue;
    }

    if (!PROVIDER_PROCESSABLE_STATUSES.has(String(task.status || ""))) {
      results.push({ refund_request_id: refund.id, task_id: task.id, skipped: true, reason: `status_${task.status}` });
      continue;
    }

    await supabaseAdmin
      .from("ecpay_refund_tasks")
      .update({ status: "processing", attempt_count: Number(task.attempt_count || 0) + 1, updated_at: new Date().toISOString() })
      .eq("id", task.id);

    await supabaseAdmin
      .from("refund_requests")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", refund.id)
      .in("status", ["approved"]);

    try {
      const providerResult = await postJson(endpoint, {
        contract_version: "calmco-ecpay-refund-adapter-v2",
        build_tag: BILLING_AUTOMATION_BUILD_TAG,
        task,
        refund_request: refund,
        payment_order: refund.payment_orders || null,
      });
      const providerRefundId = extractProviderRefundId(providerResult);

      await supabaseAdmin
        .from("ecpay_refund_tasks")
        .update({
          status: "refunded",
          provider_refund_id: providerRefundId,
          provider_payload: providerResult,
          last_error: null,
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.id);
      await supabaseAdmin
        .from("refund_requests")
        .update({
          status: "refunded",
          provider_refund_id: providerRefundId,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", refund.id);
      await supabaseAdmin.from("refund_events").insert({
        refund_request_id: refund.id,
        actor_role: "system",
        event_type: "refund_provider_refunded",
        metadata: { task_id: task.id, provider_result: providerResult, build_tag: BILLING_AUTOMATION_BUILD_TAG },
      });
      await recordRefundLedger(refund, providerResult);
      const invoiceFollowupId = await requestInvoiceVoidOrAllowanceIfNeeded(refund, providerResult);
      results.push({ refund_request_id: refund.id, task_id: task.id, status: "refunded", invoice_followup_id: invoiceFollowupId });
    } catch (error: any) {
      await supabaseAdmin
        .from("ecpay_refund_tasks")
        .update({ status: "failed", last_error: error?.message || "provider_error", updated_at: new Date().toISOString() })
        .eq("id", task.id);
      await supabaseAdmin
        .from("refund_requests")
        .update({ status: "approved", updated_at: new Date().toISOString() })
        .eq("id", refund.id)
        .eq("status", "processing");
      results.push({ refund_request_id: refund.id, task_id: task.id, error: error?.message || "provider_error" });
    }
  }
  return results;
}

export async function processSubscriptionTasks(limit = 20) {
  const liveEnabled = envFlag("ECPAY_SUBSCRIPTION_API_ENABLED");
  const endpoint = String(process.env.ECPAY_SUBSCRIPTION_ENDPOINT || "").trim();
  const tasks = await supabaseAdmin
    .from("ecpay_subscription_tasks")
    .select("*, subscription_profiles(*)")
    .in("status", ["queued", "failed", "manual_required"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);
  if (tasks.error) throw tasks.error;
  const results: any[] = [];

  for (const task of tasks.data ?? []) {
    if (!liveEnabled || !endpoint) {
      await supabaseAdmin.from("ecpay_subscription_tasks").update({ status: "manual_required", updated_at: new Date().toISOString() }).eq("id", task.id);
      results.push({ subscription_task_id: task.id, status: "manual_required" });
      continue;
    }

    await supabaseAdmin.from("ecpay_subscription_tasks").update({ status: "processing", attempt_count: Number(task.attempt_count || 0) + 1, updated_at: new Date().toISOString() }).eq("id", task.id);
    try {
      const providerResult = await postJson(endpoint, {
        contract_version: "calmco-ecpay-subscription-adapter-v1",
        task,
        subscription_profile: task.subscription_profiles,
        build_tag: BILLING_AUTOMATION_BUILD_TAG,
      });
      await supabaseAdmin.from("ecpay_subscription_tasks").update({ status: "completed", provider_task_id: providerResult.task_id ?? providerResult.TradeNo ?? null, provider_payload: providerResult, processed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", task.id);
      if (task.action_type === "cancel_profile" && task.subscription_profile_id) {
        await supabaseAdmin.from("subscription_profiles").update({ status: "cancelled", cancelled_at: new Date().toISOString(), raw_payload: providerResult, updated_at: new Date().toISOString() }).eq("id", task.subscription_profile_id);
      }
      results.push({ subscription_task_id: task.id, status: "completed" });
    } catch (error: any) {
      await supabaseAdmin.from("ecpay_subscription_tasks").update({ status: "failed", last_error: error?.message || "provider_error", updated_at: new Date().toISOString() }).eq("id", task.id);
      if (task.subscription_profile_id) await supabaseAdmin.from("subscription_profiles").update({ last_provider_error: error?.message || "provider_error", updated_at: new Date().toISOString() }).eq("id", task.subscription_profile_id);
      results.push({ subscription_task_id: task.id, error: error?.message || "provider_error" });
    }
  }
  return results;
}

export async function getBillingReconciliationReport(limit = 100) {
  const safeLimit = Math.min(Math.max(Number(limit || 100), 1), 300);
  const [paidOrders, ledgerRows, invoiceRows, invoiceTasks, refundRows, refundTasks, subscriptions] = await Promise.all([
    supabaseAdmin
      .from("payment_orders")
      .select("id,user_id,merchant_trade_no,plan_code,amount,currency,status,item_name,provider,provider_trade_no,paid_at,created_at")
      .eq("status", "paid")
      .order("paid_at", { ascending: false, nullsFirst: false })
      .limit(safeLimit),
    supabaseAdmin
      .from("billing_ledger")
      .select("id,user_id,payment_order_id,ledger_type,direction,amount_twd,created_at,occurred_at")
      .order("created_at", { ascending: false })
      .limit(safeLimit * 3),
    supabaseAdmin
      .from("invoice_events")
      .select("id,user_id,payment_order_id,event_type,invoice_number,invoice_random_number,created_at,issued_at,metadata")
      .order("created_at", { ascending: false })
      .limit(safeLimit * 3),
    supabaseAdmin
      .from("ecpay_invoice_tasks")
      .select("id,user_id,payment_order_id,invoice_event_id,refund_request_id,action_type,status,provider_invoice_no,last_error,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(safeLimit * 3),
    supabaseAdmin
      .from("refund_requests")
      .select("id,user_id,payment_order_id,amount_twd,status,provider_refund_id,requested_at,resolved_at,created_at")
      .order("created_at", { ascending: false })
      .limit(safeLimit * 2),
    supabaseAdmin
      .from("ecpay_refund_tasks")
      .select("id,user_id,payment_order_id,refund_request_id,status,provider_refund_id,last_error,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(safeLimit * 2),
    supabaseAdmin
      .from("subscription_profiles")
      .select("id,user_id,plan_code,status,next_charge_at,cancel_requested_at,last_provider_error,created_at")
      .in("status", ["past_due", "cancel_pending", "failed"])
      .order("created_at", { ascending: false })
      .limit(safeLimit),
  ]);

  const errors = [paidOrders.error, ledgerRows.error, invoiceRows.error, invoiceTasks.error, refundRows.error, refundTasks.error, subscriptions.error]
    .filter(Boolean)
    .map((error: any) => error.message);
  if (errors.length > 0) return { errors, build_tag: BILLING_AUTOMATION_BUILD_TAG };

  const ledgerByOrder = new Map<string, any[]>();
  for (const row of ledgerRows.data ?? []) {
    if (!row.payment_order_id) continue;
    const rows = ledgerByOrder.get(row.payment_order_id) ?? [];
    rows.push(row);
    ledgerByOrder.set(row.payment_order_id, rows);
  }

  const invoicesByOrder = new Map<string, any[]>();
  for (const row of invoiceRows.data ?? []) {
    if (!row.payment_order_id) continue;
    const rows = invoicesByOrder.get(row.payment_order_id) ?? [];
    rows.push(row);
    invoicesByOrder.set(row.payment_order_id, rows);
  }

  const refundTaskByRefund = new Map<string, any[]>();
  for (const row of refundTasks.data ?? []) {
    if (!row.refund_request_id) continue;
    const rows = refundTaskByRefund.get(row.refund_request_id) ?? [];
    rows.push(row);
    refundTaskByRefund.set(row.refund_request_id, rows);
  }

  const paidWithoutLedger = (paidOrders.data ?? []).filter((order: any) => {
    const rows = ledgerByOrder.get(order.id) ?? [];
    return !rows.some((row) => row.ledger_type === "payment");
  });

  const paidWithoutInvoice = (paidOrders.data ?? []).filter((order: any) => {
    const rows = invoicesByOrder.get(order.id) ?? [];
    return !rows.some((row) => row.event_type === "issued");
  });

  const invoiceFailedOrManual = (invoiceTasks.data ?? []).filter((task: any) => ["failed", "manual_required"].includes(String(task.status || "")));
  const invoiceFollowupRequired = (invoiceRows.data ?? []).filter((row: any) => row.event_type === "void_or_allowance_required");
  const refundApprovedNotRefunded = (refundRows.data ?? []).filter((refund: any) => ["approved", "processing"].includes(String(refund.status || "")));
  const refundApprovedWithoutTask = refundApprovedNotRefunded.filter((refund: any) => (refundTaskByRefund.get(refund.id) ?? []).length === 0);
  const refundTaskFailedOrManual = (refundTasks.data ?? []).filter((task: any) => ["failed", "manual_required"].includes(String(task.status || "")));
  const subscriptionPastDue = (subscriptions.data ?? []).filter((subscription: any) => String(subscription.status || "") === "past_due");

  return {
    summary: {
      paid_orders_sample: paidOrders.data?.length ?? 0,
      paid_without_ledger: paidWithoutLedger.length,
      paid_without_invoice: paidWithoutInvoice.length,
      invoice_failed_or_manual: invoiceFailedOrManual.length,
      invoice_followup_required: invoiceFollowupRequired.length,
      refund_approved_not_refunded: refundApprovedNotRefunded.length,
      refund_approved_without_task: refundApprovedWithoutTask.length,
      refund_task_failed_or_manual: refundTaskFailedOrManual.length,
      subscription_past_due: subscriptionPastDue.length,
      subscription_action_required: subscriptions.data?.length ?? 0,
    },
    paid_without_ledger: paidWithoutLedger,
    paid_without_invoice: paidWithoutInvoice,
    invoice_failed_or_manual: invoiceFailedOrManual,
    invoice_followup_required: invoiceFollowupRequired,
    refund_approved_not_refunded: refundApprovedNotRefunded,
    refund_approved_without_task: refundApprovedWithoutTask,
    refund_task_failed_or_manual: refundTaskFailedOrManual,
    subscription_action_required: subscriptions.data ?? [],
    build_tag: BILLING_AUTOMATION_BUILD_TAG,
  };
}
