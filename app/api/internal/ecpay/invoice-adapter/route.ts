import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeInvoicePreference, toEcpayInvoiceFields } from "@/lib/invoicePreferences";
import { allowanceB2CInvoice, invalidB2CInvoice, issueB2CInvoice, verifyAdapterRequest } from "@/lib/server/ecpayOfficialClient";

export const runtime = "nodejs";

const BUILD_TAG = "ecpay-invoice-adapter-v123-2026-07-04";

type AdapterPayload = { action_type?: string; task?: any; invoice_event?: any; payment_order?: any; invoice_request?: any; invoice_followup_request?: any };

function json(data: unknown, status = 200) { return NextResponse.json(data, { status }); }
function firstString(...values: any[]) { for (const value of values) { const text = String(value ?? "").trim(); if (text) return text; } return ""; }

function normalizeDateOnly(value: any) {
  const text = firstString(value);
  if (!text) return "";
  const normalized = text.replace(/\//g, "-");
  const direct = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (direct) return `${direct[1]}-${direct[2].padStart(2, "0")}-${direct[3].padStart(2, "0")}`;
  const date = new Date(normalized);
  if (!Number.isNaN(date.getTime())) return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return text.slice(0, 10).replace(/\//g, "-");
}

function extractProviderDate(payload: any) {
  return normalizeDateOnly(payload?.invoice_date || payload?.original_invoice_date || payload?.issued_at || payload?.IssueDate || payload?.InvoiceDate || payload?.processed_at || payload?.IA_Date || payload?.data?.InvoiceDate || payload?.data?.IA_Date || payload?.provider_result?.data?.InvoiceDate || payload?.provider_result?.data?.IA_Date || payload?.provider_result?.issued_at || payload?.provider_result?.IssueDate || payload?.provider_result?.InvoiceDate || payload?.provider_result?.provider_result?.data?.InvoiceDate || payload?.attempted_adapter_payload?.invoice_followup_request?.invoice_date);
}

function isInvoiceNotFoundProviderError(message: string) {
  return /1600003|無發票號碼資料|invoice_not_found|ecpay_invoice_not_found/i.test(String(message || ""));
}

async function resolveBuyerEmail(payload: AdapterPayload) {
  const fromPayload = firstString(payload.invoice_request?.buyer_email, payload.invoice_event?.metadata?.invoice_preference?.buyerEmail, payload.payment_order?.provider_payload?.invoice_preference?.buyerEmail, payload.invoice_event?.metadata?.customer_email, payload.payment_order?.provider_payload?.customer_email, payload.payment_order?.provider_payload?.return_url_payload?.CustomField3);
  if (fromPayload) return fromPayload;
  const userId = firstString(payload.invoice_request?.buyer_user_id, payload.invoice_event?.user_id, payload.payment_order?.user_id);
  if (!userId) return "";
  const user = await supabaseAdmin.auth.admin.getUserById(userId);
  return user.data.user?.email || "";
}

function extractInvoicePreference(payload: AdapterPayload, fallbackEmail: string) {
  const raw = payload.invoice_request?.invoice_preference || payload.invoice_event?.metadata?.invoice_preference || payload.payment_order?.provider_payload?.invoice_preference || { kind: "personal", carrierKind: "ecpay", buyerEmail: fallbackEmail };
  return normalizeInvoicePreference(raw, fallbackEmail);
}

function extractIssuedAt(payload: AdapterPayload) {
  return firstString(
    payload.invoice_followup_request?.invoice_date,
    payload.invoice_followup_request?.original_invoice_date,
    payload.invoice_event?.issued_at,
    payload.invoice_event?.metadata?.invoice_date,
    payload.invoice_event?.metadata?.original_invoice_date,
    payload.invoice_event?.metadata?.issued_at,
    payload.invoice_event?.metadata?.provider_result?.issued_at,
    payload.invoice_event?.metadata?.provider_result?.IssueDate,
    payload.invoice_event?.metadata?.provider_result?.provider_result?.data?.InvoiceDate,
    payload.invoice_event?.metadata?.provider_result?.data?.InvoiceDate,
    payload.invoice_event?.metadata?.provider_result?.data?.IA_Date,
    payload.task?.provider_payload?.invoice_followup_request?.invoice_date,
    payload.task?.provider_payload?.attempted_adapter_payload?.invoice_followup_request?.invoice_date
  );
}

async function resolveOriginalInvoiceDate(payload: AdapterPayload) {
  const direct = normalizeDateOnly(extractIssuedAt(payload));
  if (direct) return { invoiceDate: direct, source: "payload" };
  const paymentOrderId = firstString(payload.invoice_event?.payment_order_id, payload.task?.payment_order_id, payload.payment_order?.id);
  const invoiceNo = firstString(payload.invoice_followup_request?.original_invoice_number, payload.invoice_event?.invoice_number, payload.task?.provider_invoice_no);
  if (!paymentOrderId) return { invoiceDate: "", source: "missing_payment_order_id" };

  let eventQuery = supabaseAdmin.from("invoice_events").select("id, invoice_number, issued_at, created_at, metadata").eq("payment_order_id", paymentOrderId).eq("event_type", "issued").order("created_at", { ascending: false }).limit(1);
  if (invoiceNo) eventQuery = eventQuery.eq("invoice_number", invoiceNo);
  const event = await eventQuery.maybeSingle();
  if (event.error) throw event.error;
  if (event.data) {
    const invoiceDate = normalizeDateOnly(event.data.issued_at || event.data.metadata?.invoice_date || event.data.metadata?.issued_at || event.data.metadata?.provider_result?.issued_at || event.data.metadata?.provider_result?.IssueDate || event.data.metadata?.provider_result?.provider_result?.data?.InvoiceDate || event.data.metadata?.provider_result?.data?.InvoiceDate) || normalizeDateOnly(event.data.created_at);
    if (invoiceDate) return { invoiceDate, source: `invoice_events:${event.data.id}` };
  }

  let taskQuery = supabaseAdmin.from("ecpay_invoice_tasks").select("id, provider_invoice_no, provider_payload, processed_at, updated_at, created_at").eq("payment_order_id", paymentOrderId).eq("action_type", "issue").eq("status", "issued").order("processed_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(1);
  if (invoiceNo) taskQuery = taskQuery.eq("provider_invoice_no", invoiceNo);
  const task = await taskQuery.maybeSingle();
  if (task.error) throw task.error;
  if (task.data) {
    const invoiceDate = extractProviderDate(task.data.provider_payload) || normalizeDateOnly(task.data.processed_at || task.data.updated_at || task.data.created_at);
    if (invoiceDate) return { invoiceDate, source: `ecpay_invoice_tasks:${task.data.id}` };
  }

  const paymentDate = normalizeDateOnly(payload.payment_order?.paid_at || payload.payment_order?.created_at);
  if (paymentDate) return { invoiceDate: paymentDate, source: "payment_order_date_fallback" };
  return { invoiceDate: "", source: "missing_original_invoice_date" };
}

function shouldUseVoid(payload: AdapterPayload, invoiceDate: string) {
  const metadata = payload.invoice_event?.metadata || {};
  const orderAmount = Number(payload.payment_order?.amount || metadata.original_amount_twd || 0);
  const refundAmount = Number(payload.invoice_followup_request?.refund_amount_twd || metadata.refund_amount_twd || 0);
  if (!orderAmount || refundAmount < orderAmount) return false;
  if (!invoiceDate) return false;
  const issued = new Date(invoiceDate.replace(/\//g, "-"));
  if (Number.isNaN(issued.getTime())) return false;
  const month = issued.getMonth() + 1;
  const periodEndMonth = month % 2 === 1 ? month + 1 : month;
  const deadlineYear = periodEndMonth === 12 ? issued.getFullYear() + 1 : issued.getFullYear();
  const deadlineMonthIndex = periodEndMonth === 12 ? 0 : periodEndMonth;
  const deadline = new Date(deadlineYear, deadlineMonthIndex, 13, 23, 59, 59, 999);
  return new Date().getTime() <= deadline.getTime();
}

async function handleIssue(payload: AdapterPayload) {
  const req = payload.invoice_request || {};
  const email = await resolveBuyerEmail(payload);
  const preference = extractInvoicePreference(payload, email);
  const invoiceFields = toEcpayInvoiceFields(preference);
  const amount = Number(req.sales_amount || payload.invoice_event?.metadata?.amount || payload.payment_order?.amount || 0);
  const result = await issueB2CInvoice({ relateNumber: firstString(req.relate_number, payload.payment_order?.merchant_trade_no, payload.invoice_event?.id), customerEmail: invoiceFields.customerEmail, customerPhone: invoiceFields.customerPhone, customerName: invoiceFields.customerName, customerIdentifier: invoiceFields.customerIdentifier, customerAddr: firstString(req.customer_addr, payload.invoice_event?.metadata?.customer_addr), carrierType: invoiceFields.carrierType, carrierNum: invoiceFields.carrierNum, print: invoiceFields.print, donation: invoiceFields.donation, loveCode: invoiceFields.loveCode, itemName: firstString(req.item_name, payload.invoice_event?.metadata?.item_name, payload.payment_order?.item_name, "安感島服務費"), amount, remark: firstString(req.remark, payload.invoice_event?.metadata?.remark, payload.payment_order?.merchant_trade_no) });
  return { ...result, invoice_preference: preference, task_id: payload.task?.id || null, build_tag: BUILD_TAG };
}

async function handleVoid(payload: AdapterPayload, invoiceDate?: string, invoiceDateSource?: string) {
  const followup = payload.invoice_followup_request || {};
  const invoiceNo = firstString(followup.original_invoice_number, payload.invoice_event?.invoice_number, payload.task?.provider_invoice_no);
  if (!invoiceNo) return { status: "manual_required", manual_required: true, reason: "missing_original_invoice_number", build_tag: BUILD_TAG };
  const resolved = invoiceDate ? { invoiceDate, source: invoiceDateSource || "caller" } : await resolveOriginalInvoiceDate(payload);
  if (!resolved.invoiceDate) return { status: "manual_required", manual_required: true, reason: resolved.source || "missing_original_invoice_date", build_tag: BUILD_TAG };
  const result = await invalidB2CInvoice({ invoiceNo, invoiceDate: resolved.invoiceDate, reason: firstString(followup.reason, "退款作廢") });
  return { ...result, invoice_date: resolved.invoiceDate, invoice_date_source: resolved.source, task_id: payload.task?.id || null, build_tag: BUILD_TAG };
}

async function handleAllowance(payload: AdapterPayload, invoiceDate?: string, invoiceDateSource?: string) {
  const followup = payload.invoice_followup_request || {};
  const invoiceNo = firstString(followup.original_invoice_number, payload.invoice_event?.invoice_number, payload.task?.provider_invoice_no);
  if (!invoiceNo) return { status: "manual_required", manual_required: true, reason: "missing_original_invoice_number", build_tag: BUILD_TAG };
  const resolved = invoiceDate ? { invoiceDate, source: invoiceDateSource || "caller" } : await resolveOriginalInvoiceDate(payload);
  if (!resolved.invoiceDate) return { status: "manual_required", manual_required: true, reason: resolved.source || "missing_original_invoice_date", build_tag: BUILD_TAG };
  const email = await resolveBuyerEmail(payload);
  const amount = Number(followup.refund_amount_twd || payload.invoice_event?.metadata?.refund_amount_twd || payload.payment_order?.amount || 0);
  const result = await allowanceB2CInvoice({ invoiceNo, invoiceDate: resolved.invoiceDate, reason: firstString(followup.reason, "退款折讓"), allowanceAmount: amount, notifyMail: email, customerName: firstString(payload.invoice_event?.metadata?.customer_name), itemName: firstString(payload.invoice_event?.metadata?.item_name, payload.payment_order?.item_name, "安感島服務費退款") });
  return { ...result, invoice_date: resolved.invoiceDate, invoice_date_source: resolved.source, task_id: payload.task?.id || null, build_tag: BUILD_TAG };
}

export async function GET(req: Request) {
  try { verifyAdapterRequest(req); return json({ ok: true, adapter: "invoice", build_tag: BUILD_TAG }); }
  catch (error: any) { return json({ ok: false, error: error?.message || "unauthorized" }, error?.status || 401); }
}

export async function POST(req: Request) {
  try {
    verifyAdapterRequest(req);
    const payload = (await req.json().catch(() => ({}))) as AdapterPayload;
    const action = String(payload.action_type || payload.task?.action_type || "issue");
    if (action === "issue") return json(await handleIssue(payload));
    const resolved = await resolveOriginalInvoiceDate(payload);
    if (action === "void") return json(await handleVoid(payload, resolved.invoiceDate, resolved.source));
    if (action === "allowance") return json(await handleAllowance(payload, resolved.invoiceDate, resolved.source));
    if (action === "void_or_allowance") return json(shouldUseVoid(payload, resolved.invoiceDate) ? await handleVoid(payload, resolved.invoiceDate, resolved.source) : await handleAllowance(payload, resolved.invoiceDate, resolved.source));
    return json({ status: "manual_required", manual_required: true, reason: `unsupported_invoice_action_${action}`, build_tag: BUILD_TAG }, 200);
  } catch (error: any) {
    const message = error?.message || "invoice_adapter_error";
    if (isInvoiceNotFoundProviderError(message)) {
      return json({ status: "manual_required", manual_required: true, reason: "ecpay_invoice_not_found_for_api", provider_error: message, build_tag: BUILD_TAG }, 200);
    }
    const status = error?.status || (/UNAUTHORIZED/.test(message) ? 401 : 500);
    return json({ status: "failed", error: message, build_tag: BUILD_TAG }, status);
  }
}
