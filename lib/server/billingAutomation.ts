import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const BILLING_AUTOMATION_BUILD_TAG = "billing-automation-v114-2026-06-10";

const INVOICE_TERMINAL_STATUSES = new Set(["issued", "completed", "cancelled"]);
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

async function postJson(endpoint: string, payload: Record<string, unknown>) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-calmco-billing-build": BILLING_AUTOMATION_BUILD_TAG,
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`provider_http_${response.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function insertIfMissing(input: { table: string; filters: Record<string, string>; row: Record<string, unknown> }) {
  let query = supabaseAdmin.from(input.table).select("id").limit(1);
  for (const [key, value] of Object.entries(input.filters)) query = query.eq(key, value);

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

function buildInvoiceAdapterPayload(task: any, invoice: any) {
  const order = invoice?.payment_orders || {};
  return {
    contract_version: "calmco-ecpay-invoice-adapter-v1",
    build_tag: BILLING_AUTOMATION_BUILD_TAG,
    task: {
      id: task.id,
      invoice_event_id: task.invoice_event_id,
      payment_order_id: task.payment_order_id,
      user_id: task.user_id,
      attempt_count: Number(task.attempt_count || 0),
    },
    invoice_event: invoice,
    payment_order: order,
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

async function getOrCreateInvoiceTask(invoice: any, liveEnabled: boolean, endpoint: string) {
  const existing = await supabaseAdmin
    .from("ecpay_invoice_tasks")
    .select("*")
    .eq("invoice_event_id", invoice.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return { task: existing.data, created: false };

  const inserted = await supabaseAdmin
    .from("ecpay_invoice_tasks")
    .insert({
      invoice_event_id: invoice.id,
      payment_order_id: invoice.payment_order_id,
      user_id: invoice.user_id,
      status: liveEnabled && endpoint ? "queued" : "manual_required",
      provider_payload: {
        invoice_event: invoice,
        mode: liveEnabled && endpoint ? "live_endpoint_ready" : "manual_required",
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
    metadata: {
      task_id: task.id,
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
    .eq("event_type", "requested")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (pending.error) throw pending.error;
  const results: any[] = [];

  for (const invoice of pending.data ?? []) {
    if (await paymentOrderHasIssuedInvoice(invoice.payment_order_id)) {
      results.push({ invoice_event_id: invoice.id, skipped: true, reason: "already_issued_for_payment_order" });
      continue;
    }

    let task: any;
    try {
      task = (await getOrCreateInvoiceTask(invoice, liveEnabled, endpoint)).task;
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
      results.push({ invoice_event_id: invoice.id, task_id: task.id, status: "manual_required" });
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
      const providerResult = await postJson(endpoint, buildInvoiceAdapterPayload(task, invoice));
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
  if (!refund?.id || !refund?.user_id) return;
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

    if (["refunded", "completed", "cancelled"].includes(String(task.status || ""))) {
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

    try {
      const providerResult = await postJson(endpoint, {
        contract_version: "calmco-ecpay-refund-adapter-v1",
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
      const providerResult = await postJson(endpoint, { task, subscription_profile: task.subscription_profiles, build_tag: BILLING_AUTOMATION_BUILD_TAG });
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
  const [paidOrders, ledgerRows, invoiceRows, invoiceTasks, refundRows, subscriptions] = await Promise.all([
    supabaseAdmin
      .from("payment_orders")
      .select("id,user_id,merchant_trade_no,plan_code,amount,currency,status,item_name,provider_trade_no,paid_at,created_at")
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
      .select("id,user_id,payment_order_id,invoice_event_id,status,provider_invoice_no,last_error,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(safeLimit * 3),
    supabaseAdmin
      .from("refund_requests")
      .select("id,user_id,payment_order_id,amount_twd,status,provider_refund_id,requested_at,resolved_at,created_at")
      .order("created_at", { ascending: false })
      .limit(safeLimit * 2),
    supabaseAdmin
      .from("subscription_profiles")
      .select("id,user_id,plan_code,status,next_charge_at,cancel_requested_at,last_provider_error,created_at")
      .in("status", ["past_due", "cancel_pending", "failed"])
      .order("created_at", { ascending: false })
      .limit(safeLimit),
  ]);

  const errors = [paidOrders.error, ledgerRows.error, invoiceRows.error, invoiceTasks.error, refundRows.error, subscriptions.error]
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

  const paidWithoutLedger = (paidOrders.data ?? []).filter((order: any) => {
    const rows = ledgerByOrder.get(order.id) ?? [];
    return !rows.some((row) => row.ledger_type === "payment");
  });

  const paidWithoutInvoice = (paidOrders.data ?? []).filter((order: any) => {
    const rows = invoicesByOrder.get(order.id) ?? [];
    return !rows.some((row) => row.event_type === "issued");
  });

  const invoiceFailedOrManual = (invoiceTasks.data ?? []).filter((task: any) => ["failed", "manual_required"].includes(String(task.status || "")));
  const refundApprovedNotRefunded = (refundRows.data ?? []).filter((refund: any) => ["approved", "processing"].includes(String(refund.status || "")));
  const subscriptionPastDue = (subscriptions.data ?? []).filter((subscription: any) => String(subscription.status || "") === "past_due");

  return {
    summary: {
      paid_orders_sample: paidOrders.data?.length ?? 0,
      paid_without_ledger: paidWithoutLedger.length,
      paid_without_invoice: paidWithoutInvoice.length,
      invoice_failed_or_manual: invoiceFailedOrManual.length,
      refund_approved_not_refunded: refundApprovedNotRefunded.length,
      subscription_past_due: subscriptionPastDue.length,
      subscription_action_required: subscriptions.data?.length ?? 0,
    },
    paid_without_ledger: paidWithoutLedger,
    paid_without_invoice: paidWithoutInvoice,
    invoice_failed_or_manual: invoiceFailedOrManual,
    refund_approved_not_refunded: refundApprovedNotRefunded,
    subscription_action_required: subscriptions.data ?? [],
    build_tag: BILLING_AUTOMATION_BUILD_TAG,
  };
}
