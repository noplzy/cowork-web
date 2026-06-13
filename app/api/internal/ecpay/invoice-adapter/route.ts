import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  allowanceB2CInvoice,
  invalidB2CInvoice,
  issueB2CInvoice,
  verifyAdapterRequest,
} from "@/lib/server/ecpayOfficialClient";

export const runtime = "nodejs";

const BUILD_TAG = "ecpay-invoice-adapter-v116-2026-06-13";

type AdapterPayload = {
  action_type?: string;
  task?: any;
  invoice_event?: any;
  payment_order?: any;
  invoice_request?: any;
  invoice_followup_request?: any;
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function firstString(...values: any[]) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

async function resolveBuyerEmail(payload: AdapterPayload) {
  const fromPayload = firstString(
    payload.invoice_request?.buyer_email,
    payload.invoice_event?.metadata?.customer_email,
    payload.payment_order?.provider_payload?.customer_email,
    payload.payment_order?.provider_payload?.return_url_payload?.CustomField3,
  );
  if (fromPayload) return fromPayload;

  const userId = firstString(payload.invoice_request?.buyer_user_id, payload.invoice_event?.user_id, payload.payment_order?.user_id);
  if (!userId) return "";
  const user = await supabaseAdmin.auth.admin.getUserById(userId);
  return user.data.user?.email || "";
}

function extractIssuedAt(payload: AdapterPayload) {
  return firstString(payload.invoice_event?.issued_at, payload.invoice_event?.metadata?.issued_at, payload.invoice_event?.metadata?.provider_result?.issued_at);
}

function shouldUseVoid(payload: AdapterPayload) {
  const metadata = payload.invoice_event?.metadata || {};
  const orderAmount = Number(payload.payment_order?.amount || metadata.original_amount_twd || 0);
  const refundAmount = Number(payload.invoice_followup_request?.refund_amount_twd || metadata.refund_amount_twd || 0);
  if (!orderAmount || refundAmount < orderAmount) return false;

  const issuedAt = extractIssuedAt(payload);
  if (!issuedAt) return false;
  const issued = new Date(String(issuedAt).replace(/\//g, "-"));
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
  const amount = Number(req.sales_amount || payload.invoice_event?.metadata?.amount || payload.payment_order?.amount || 0);
  const result = await issueB2CInvoice({
    relateNumber: firstString(req.relate_number, payload.payment_order?.merchant_trade_no, payload.invoice_event?.id),
    customerEmail: email,
    customerPhone: firstString(req.customer_phone, payload.invoice_event?.metadata?.customer_phone),
    customerName: firstString(req.customer_name, payload.invoice_event?.metadata?.customer_name),
    customerIdentifier: firstString(req.customer_identifier, payload.invoice_event?.metadata?.customer_identifier),
    customerAddr: firstString(req.customer_addr, payload.invoice_event?.metadata?.customer_addr),
    carrierType: firstString(req.carrier_type, payload.invoice_event?.metadata?.carrier_type) || "1",
    carrierNum: firstString(req.carrier_num, payload.invoice_event?.metadata?.carrier_num),
    print: (firstString(req.print, payload.invoice_event?.metadata?.print) || "0") as "0" | "1",
    donation: (firstString(req.donation, payload.invoice_event?.metadata?.donation) || "0") as "0" | "1",
    loveCode: firstString(req.love_code, payload.invoice_event?.metadata?.love_code),
    itemName: firstString(req.item_name, payload.invoice_event?.metadata?.item_name, payload.payment_order?.item_name, "安感島服務費"),
    amount,
    remark: firstString(req.remark, payload.invoice_event?.metadata?.remark, payload.payment_order?.merchant_trade_no),
  });
  return { ...result, task_id: payload.task?.id || null, build_tag: BUILD_TAG };
}

async function handleVoid(payload: AdapterPayload) {
  const followup = payload.invoice_followup_request || {};
  const result = await invalidB2CInvoice({
    invoiceNo: firstString(followup.original_invoice_number, payload.invoice_event?.invoice_number),
    invoiceDate: firstString(followup.invoice_date, extractIssuedAt(payload)),
    reason: firstString(followup.reason, "退款作廢"),
  });
  return { ...result, task_id: payload.task?.id || null, build_tag: BUILD_TAG };
}

async function handleAllowance(payload: AdapterPayload) {
  const followup = payload.invoice_followup_request || {};
  const email = await resolveBuyerEmail(payload);
  const amount = Number(followup.refund_amount_twd || payload.invoice_event?.metadata?.refund_amount_twd || payload.payment_order?.amount || 0);
  const result = await allowanceB2CInvoice({
    invoiceNo: firstString(followup.original_invoice_number, payload.invoice_event?.invoice_number),
    invoiceDate: firstString(followup.invoice_date, extractIssuedAt(payload)),
    reason: firstString(followup.reason, "退款折讓"),
    allowanceAmount: amount,
    notifyMail: email,
    customerName: firstString(payload.invoice_event?.metadata?.customer_name),
    itemName: firstString(payload.invoice_event?.metadata?.item_name, payload.payment_order?.item_name, "安感島服務費退款"),
  });
  return { ...result, task_id: payload.task?.id || null, build_tag: BUILD_TAG };
}

export async function GET(req: Request) {
  try {
    verifyAdapterRequest(req);
    return json({ ok: true, adapter: "invoice", build_tag: BUILD_TAG });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || "unauthorized" }, error?.status || 401);
  }
}

export async function POST(req: Request) {
  try {
    verifyAdapterRequest(req);
    const payload = (await req.json().catch(() => ({}))) as AdapterPayload;
    const action = String(payload.action_type || payload.task?.action_type || "issue");

    if (action === "issue") return json(await handleIssue(payload));
    if (action === "void") return json(await handleVoid(payload));
    if (action === "allowance") return json(await handleAllowance(payload));
    if (action === "void_or_allowance") return json(shouldUseVoid(payload) ? await handleVoid(payload) : await handleAllowance(payload));

    return json({ status: "manual_required", manual_required: true, reason: `unsupported_invoice_action_${action}`, build_tag: BUILD_TAG }, 200);
  } catch (error: any) {
    const message = error?.message || "invoice_adapter_error";
    const status = error?.status || (/UNAUTHORIZED/.test(message) ? 401 : 500);
    return json({ status: "failed", error: message, build_tag: BUILD_TAG }, status);
  }
}
