import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const BILLING_AUTOMATION_BUILD_TAG = "billing-automation-v108-2026-06-04";

function envFlag(name: string) {
  return ["1", "true", "yes", "enabled"].includes(String(process.env[name] || "").trim().toLowerCase());
}

export function verifyBillingAutomationSecret(req: Request) {
  const expected = process.env.BILLING_AUTOMATION_SECRET || process.env.ROOM_CLEANUP_SECRET || process.env.CRON_SECRET;
  if (!expected) throw new Error("Missing BILLING_AUTOMATION_SECRET / ROOM_CLEANUP_SECRET / CRON_SECRET");
  const got = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
  if (got !== expected) throw Object.assign(new Error("UNAUTHORIZED_BILLING_AUTOMATION"), { status: 401 });
}

async function postJson(endpoint: string, payload: Record<string, unknown>) {
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const text = await response.text();
  if (!response.ok) throw new Error(`provider_http_${response.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

export async function processInvoiceTasks(limit = 20) {
  const liveEnabled = envFlag("ECPAY_INVOICE_API_ENABLED");
  const endpoint = String(process.env.ECPAY_INVOICE_ENDPOINT || "").trim();
  const pending = await supabaseAdmin.from("invoice_events").select("*, payment_orders(*)").eq("event_type", "requested").order("created_at", { ascending: true }).limit(limit);
  if (pending.error) throw pending.error;
  const results: any[] = [];

  for (const invoice of pending.data ?? []) {
    const existing = await supabaseAdmin.from("ecpay_invoice_tasks").select("id,status").eq("invoice_event_id", invoice.id).limit(1).maybeSingle();
    if (existing.data) { results.push({ invoice_event_id: invoice.id, skipped: true, reason: "task_exists", task: existing.data }); continue; }

    const inserted = await supabaseAdmin.from("ecpay_invoice_tasks").insert({
      invoice_event_id: invoice.id,
      payment_order_id: invoice.payment_order_id,
      user_id: invoice.user_id,
      status: liveEnabled && endpoint ? "queued" : "manual_required",
      provider_payload: { invoice_event: invoice, mode: liveEnabled && endpoint ? "live_endpoint_ready" : "manual_required" },
    }).select("*").single();
    if (inserted.error || !inserted.data) { results.push({ invoice_event_id: invoice.id, error: inserted.error?.message || "insert_failed" }); continue; }
    const task = inserted.data;

    if (liveEnabled && endpoint) {
      await supabaseAdmin.from("ecpay_invoice_tasks").update({ status: "processing", attempt_count: task.attempt_count + 1, updated_at: new Date().toISOString() }).eq("id", task.id);
      try {
        const providerResult = await postJson(endpoint, { task, invoice_event: invoice });
        await supabaseAdmin.from("ecpay_invoice_tasks").update({ status: "issued", provider_invoice_no: providerResult.invoice_number ?? providerResult.InvoiceNo ?? null, provider_random_number: providerResult.random_number ?? providerResult.RandomNumber ?? null, provider_payload: providerResult, processed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", task.id);
        await supabaseAdmin.from("invoice_events").insert({ user_id: invoice.user_id, payment_order_id: invoice.payment_order_id, provider: "ecpay_invoice", event_type: "issued", invoice_number: providerResult.invoice_number ?? providerResult.InvoiceNo ?? null, invoice_random_number: providerResult.random_number ?? providerResult.RandomNumber ?? null, issued_at: new Date().toISOString(), metadata: { task_id: task.id, provider_result: providerResult } });
        results.push({ invoice_event_id: invoice.id, task_id: task.id, status: "issued" });
      } catch (error: any) {
        await supabaseAdmin.from("ecpay_invoice_tasks").update({ status: "failed", last_error: error?.message || "provider_error", updated_at: new Date().toISOString() }).eq("id", task.id);
        results.push({ invoice_event_id: invoice.id, task_id: task.id, error: error?.message || "provider_error" });
      }
    } else {
      results.push({ invoice_event_id: invoice.id, task_id: task.id, status: "manual_required" });
    }
  }
  return results;
}

export async function processRefundTasks(limit = 20) {
  const liveEnabled = envFlag("ECPAY_REFUND_API_ENABLED");
  const endpoint = String(process.env.ECPAY_REFUND_ENDPOINT || "").trim();
  const pending = await supabaseAdmin.from("refund_requests").select("*, payment_orders(*)").in("status", ["approved", "processing"]).order("created_at", { ascending: true }).limit(limit);
  if (pending.error) throw pending.error;
  const results: any[] = [];

  for (const refund of pending.data ?? []) {
    const existing = await supabaseAdmin.from("ecpay_refund_tasks").select("id,status").eq("refund_request_id", refund.id).limit(1).maybeSingle();
    if (existing.data) { results.push({ refund_request_id: refund.id, skipped: true, reason: "task_exists", task: existing.data }); continue; }

    const inserted = await supabaseAdmin.from("ecpay_refund_tasks").insert({
      refund_request_id: refund.id,
      payment_order_id: refund.payment_order_id,
      user_id: refund.user_id,
      status: liveEnabled && endpoint ? "queued" : "manual_required",
      provider_payload: { refund_request: refund, mode: liveEnabled && endpoint ? "live_endpoint_ready" : "manual_required" },
    }).select("*").single();
    if (inserted.error || !inserted.data) { results.push({ refund_request_id: refund.id, error: inserted.error?.message || "insert_failed" }); continue; }
    const task = inserted.data;

    if (liveEnabled && endpoint) {
      await supabaseAdmin.from("ecpay_refund_tasks").update({ status: "processing", attempt_count: task.attempt_count + 1, updated_at: new Date().toISOString() }).eq("id", task.id);
      try {
        const providerResult = await postJson(endpoint, { task, refund_request: refund });
        await supabaseAdmin.from("ecpay_refund_tasks").update({ status: "refunded", provider_refund_id: providerResult.refund_id ?? providerResult.TradeNo ?? null, provider_payload: providerResult, processed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", task.id);
        await supabaseAdmin.from("refund_requests").update({ status: "refunded", provider_refund_id: providerResult.refund_id ?? providerResult.TradeNo ?? null, resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", refund.id);
        await supabaseAdmin.from("refund_events").insert({ refund_request_id: refund.id, actor_role: "system", event_type: "refund_provider_refunded", metadata: { task_id: task.id, provider_result: providerResult } });
        results.push({ refund_request_id: refund.id, task_id: task.id, status: "refunded" });
      } catch (error: any) {
        await supabaseAdmin.from("ecpay_refund_tasks").update({ status: "failed", last_error: error?.message || "provider_error", updated_at: new Date().toISOString() }).eq("id", task.id);
        results.push({ refund_request_id: refund.id, task_id: task.id, error: error?.message || "provider_error" });
      }
    } else {
      results.push({ refund_request_id: refund.id, task_id: task.id, status: "manual_required" });
    }
  }
  return results;
}
