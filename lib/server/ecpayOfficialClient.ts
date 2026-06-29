import crypto from "node:crypto";
import { createCheckMacValue, parseFormEncodedPayload } from "@/lib/ecpay";

export const ECPAY_OFFICIAL_CLIENT_BUILD_TAG = "ecpay-official-client-v119-2026-06-27";

type Scope = "INVOICE" | "REFUND" | "SUBSCRIPTION" | "PAYMENT";

type OfficialConfig = { merchantId: string; hashKey: string; hashIV: string; stage: boolean };
type InvoicePath = "Issue" | "Invalid" | "Allowance" | "CheckBarcode" | "CheckLoveCode" | "GetCompanyNameByTaxID";

type InvoiceEnvelope = { MerchantID: string; RqHeader: { Timestamp: number }; Data: string };

export type EcpayInvoiceIssueInput = {
  relateNumber: string;
  customerEmail: string;
  customerPhone?: string;
  customerName?: string;
  customerIdentifier?: string;
  customerAddr?: string;
  carrierType?: string;
  carrierNum?: string;
  print?: "0" | "1";
  donation?: "0" | "1";
  loveCode?: string;
  itemName: string;
  amount: number;
  remark?: string;
};

export type EcpayInvoiceFollowupInput = {
  invoiceNo: string;
  invoiceDate: string;
  reason?: string;
  allowanceAmount?: number;
  notifyMail?: string;
  customerName?: string;
  itemName?: string;
};

export type EcpayRefundInput = { merchantTradeNo: string; tradeNo: string; amount: number; action?: "R" | "N" | "E" | "C" };
export type EcpaySubscriptionActionInput = { merchantTradeNo: string; action: "Cancel" | "ReAuth" };

function parseStageFlag(value: string | undefined): boolean {
  return ["true", "1", "test", "stage", "staging"].includes(String(value || "").trim().toLowerCase());
}

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function requireEnv(name: string): string {
  const value = getEnv(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function scopedEnv(scope: Scope, key: "MERCHANT_ID" | "HASH_KEY" | "HASH_IV" | "STAGE") {
  if (scope === "PAYMENT") return getEnv(`ECPAY_${key}`);
  return getEnv(`ECPAY_${scope}_${key}`) || getEnv(`ECPAY_${key}`);
}

export function getOfficialEcpayConfig(scope: Scope): OfficialConfig {
  const merchantId = scopedEnv(scope, "MERCHANT_ID") || requireEnv("ECPAY_MERCHANT_ID");
  const hashKey = scopedEnv(scope, "HASH_KEY") || requireEnv("ECPAY_HASH_KEY");
  const hashIV = scopedEnv(scope, "HASH_IV") || requireEnv("ECPAY_HASH_IV");
  const stage = parseStageFlag(scopedEnv(scope, "STAGE") || process.env.ECPAY_STAGE);
  return { merchantId, hashKey, hashIV, stage };
}

export function verifyAdapterRequest(req: Request) {
  const expected = process.env.ECPAY_ADAPTER_SECRET || process.env.BILLING_AUTOMATION_SECRET || "";
  if (!expected) throw Object.assign(new Error("Missing ECPAY_ADAPTER_SECRET / BILLING_AUTOMATION_SECRET"), { status: 500 });
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";
  const got = req.headers.get("x-internal-secret") || new URL(req.url).searchParams.get("secret") || bearer;
  if (got !== expected) throw Object.assign(new Error("UNAUTHORIZED_ECPAY_ADAPTER"), { status: 401 });
}

function assertAesKeyMaterial(config: OfficialConfig) {
  if (Buffer.byteLength(config.hashKey, "utf8") !== 16) throw new Error("ECPAY invoice HashKey must be 16 bytes for AES-128-CBC");
  if (Buffer.byteLength(config.hashIV, "utf8") !== 16) throw new Error("ECPAY invoice HashIV must be 16 bytes for AES-128-CBC");
}

function invoiceUrl(path: InvoicePath, config: OfficialConfig) {
  const base = config.stage ? "https://einvoice-stage.ecpay.com.tw" : "https://einvoice.ecpay.com.tw";
  return `${base}/B2CInvoice/${path}`;
}

function paymentUrl(path: "CreditDetail/DoAction" | "Cashier/CreditCardPeriodAction", config: OfficialConfig) {
  if (path === "CreditDetail/DoAction") return config.stage ? "https://payment-stage.ecpay.com.tw/CreditDetail/DoAction" : "https://payment.ecpay.com.tw/CreditDetail/DoAction";
  const base = config.stage ? "https://payment-stage.ecpay.com.tw" : "https://payment.ecpay.com.tw";
  return `${base}/Cashier/CreditCardPeriodAction`;
}

function encryptInvoiceData(data: Record<string, unknown>, config: OfficialConfig) {
  assertAesKeyMaterial(config);
  const json = JSON.stringify(data);
  const encoded = encodeURIComponent(json);
  const cipher = crypto.createCipheriv("aes-128-cbc", Buffer.from(config.hashKey, "utf8"), Buffer.from(config.hashIV, "utf8"));
  cipher.setAutoPadding(true);
  return cipher.update(encoded, "utf8", "base64") + cipher.final("base64");
}

function decryptInvoiceData(data: string, config: OfficialConfig) {
  assertAesKeyMaterial(config);
  const decipher = crypto.createDecipheriv("aes-128-cbc", Buffer.from(config.hashKey, "utf8"), Buffer.from(config.hashIV, "utf8"));
  decipher.setAutoPadding(true);
  const encoded = decipher.update(data, "base64", "utf8") + decipher.final("utf8");
  return JSON.parse(decodeURIComponent(encoded));
}

async function postInvoice(path: InvoicePath, data: Record<string, unknown>) {
  const config = getOfficialEcpayConfig("INVOICE");
  const envelope: InvoiceEnvelope = { MerchantID: config.merchantId, RqHeader: { Timestamp: Math.floor(Date.now() / 1000) }, Data: encryptInvoiceData({ MerchantID: config.merchantId, ...data }, config) };
  const response = await fetch(invoiceUrl(path, config), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(envelope) });
  const text = await response.text();
  if (!response.ok) throw new Error(`ecpay_invoice_http_${response.status}: ${text}`);
  const json = JSON.parse(text || "{}");
  const decrypted = json.Data ? decryptInvoiceData(String(json.Data), config) : null;
  const transCode = Number(json.TransCode ?? 0);
  const rtnCode = Number(decrypted?.RtnCode ?? 0);
  if (transCode !== 1 || rtnCode !== 1) {
    throw new Error(`ecpay_invoice_${path.toLowerCase()}_failed: TransCode=${json.TransCode ?? ""}; TransMsg=${json.TransMsg ?? ""}; RtnCode=${decrypted?.RtnCode ?? ""}; RtnMsg=${decrypted?.RtnMsg ?? ""}`);
  }
  return { transport: json, data: decrypted };
}

async function postInvoiceValidation(path: "CheckBarcode" | "CheckLoveCode" | "GetCompanyNameByTaxID", data: Record<string, unknown>) {
  const config = getOfficialEcpayConfig("INVOICE");
  const envelope: InvoiceEnvelope = { MerchantID: config.merchantId, RqHeader: { Timestamp: Math.floor(Date.now() / 1000) }, Data: encryptInvoiceData({ MerchantID: config.merchantId, ...data }, config) };
  const response = await fetch(invoiceUrl(path, config), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(envelope) });
  const text = await response.text();
  if (!response.ok) throw new Error(`ecpay_invoice_validation_http_${response.status}: ${text}`);
  const json = JSON.parse(text || "{}");
  const decrypted = json.Data ? decryptInvoiceData(String(json.Data), config) : null;
  return { transport: json, data: decrypted, build_tag: ECPAY_OFFICIAL_CLIENT_BUILD_TAG };
}

function normalizeRelateNumber(value: string) {
  const clean = String(value || "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 50);
  if (!clean) throw new Error("missing_invoice_relate_number");
  return clean;
}

function normalizeInvoiceDate(value: string) {
  if (!value) throw new Error("missing_invoice_date");
  const date = new Date(String(value).replace(/\//g, "-"));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10).replace(/\//g, "-");
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export async function checkMobileBarcode(barCode: string) {
  const result = await postInvoiceValidation("CheckBarcode", { BarCode: barCode });
  return { ok: result.data?.IsExist === "Y", is_exist: result.data?.IsExist || "", provider_result: result, build_tag: ECPAY_OFFICIAL_CLIENT_BUILD_TAG };
}

export async function checkLoveCode(loveCode: string) {
  const result = await postInvoiceValidation("CheckLoveCode", { LoveCode: loveCode });
  return { ok: result.data?.IsExist === "Y", is_exist: result.data?.IsExist || "", organ_name: result.data?.OrganName || "", provider_result: result, build_tag: ECPAY_OFFICIAL_CLIENT_BUILD_TAG };
}

export async function lookupBusinessIdentifier(unifiedBusinessNo: string) {
  const result = await postInvoiceValidation("GetCompanyNameByTaxID", { UnifiedBusinessNo: unifiedBusinessNo });
  return { ok: Number(result.data?.RtnCode ?? 0) === 1, company_name: result.data?.CompanyName || "", provider_result: result, build_tag: ECPAY_OFFICIAL_CLIENT_BUILD_TAG };
}

export async function issueB2CInvoice(input: EcpayInvoiceIssueInput) {
  const amount = Math.round(Number(input.amount || 0));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("invalid_invoice_amount");
  if (!input.customerEmail && !input.customerPhone) throw new Error("missing_customer_email_or_phone_for_invoice");

  const customerIdentifier = String(input.customerIdentifier || "").trim();
  const carrierType = input.carrierType ?? "1";
  const print = input.print ?? (customerIdentifier && !carrierType ? "1" : "0");
  const donation = input.donation ?? "0";

  const data: Record<string, unknown> = {
    RelateNumber: normalizeRelateNumber(input.relateNumber),
    CustomerID: "",
    CustomerIdentifier: donation === "1" ? "" : customerIdentifier,
    CustomerName: input.customerName || "",
    CustomerAddr: input.customerAddr || "",
    CustomerPhone: input.customerPhone || "",
    CustomerEmail: input.customerEmail || "",
    ClearanceMark: "",
    Print: donation === "1" ? "0" : print,
    Donation: donation,
    LoveCode: donation === "1" ? input.loveCode || "" : "",
    CarrierType: donation === "1" ? "" : carrierType,
    CarrierNum: donation === "1" ? "" : input.carrierNum || "",
    TaxType: "1",
    SalesAmount: amount,
    InvType: "07",
    vat: "1",
    InvoiceRemark: input.remark || "",
    Items: [{ ItemSeq: 1, ItemName: String(input.itemName || "安感島服務費").slice(0, 500), ItemCount: 1, ItemWord: "式", ItemPrice: amount, ItemTaxType: "1", ItemAmount: amount, ItemRemark: "" }],
  };

  const result = await postInvoice("Issue", data);
  return { status: "issued", invoice_event_type: "issued", invoice_number: result.data.InvoiceNo, random_number: result.data.RandomNumber, issued_at: result.data.InvoiceDate, RtnCode: result.data.RtnCode, RtnMsg: result.data.RtnMsg, provider_result: result, build_tag: ECPAY_OFFICIAL_CLIENT_BUILD_TAG };
}

export async function invalidB2CInvoice(input: EcpayInvoiceFollowupInput) {
  if (!input.invoiceNo) throw new Error("missing_invoice_number_for_invalid");
  const result = await postInvoice("Invalid", { InvoiceNo: input.invoiceNo, InvoiceDate: normalizeInvoiceDate(input.invoiceDate), Reason: (input.reason || "退款作廢").slice(0, 20) });
  return { status: "voided", invoice_event_type: "voided", invoice_number: input.invoiceNo, processed_at: new Date().toISOString(), RtnCode: result.data.RtnCode, RtnMsg: result.data.RtnMsg, provider_result: result, build_tag: ECPAY_OFFICIAL_CLIENT_BUILD_TAG };
}

export async function allowanceB2CInvoice(input: EcpayInvoiceFollowupInput) {
  if (!input.invoiceNo) throw new Error("missing_invoice_number_for_allowance");
  const amount = Math.round(Number(input.allowanceAmount || 0));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("invalid_allowance_amount");
  const result = await postInvoice("Allowance", { InvoiceNo: input.invoiceNo, InvoiceDate: normalizeInvoiceDate(input.invoiceDate), AllowanceNotify: input.notifyMail ? "E" : "N", CustomerName: input.customerName || "", NotifyMail: input.notifyMail || "", NotifyPhone: "", AllowanceAmount: amount, Reason: (input.reason || "退款折讓").slice(0, 50), Items: [{ ItemSeq: 1, ItemName: String(input.itemName || "安感島服務費退款").slice(0, 500), ItemCount: 1, ItemWord: "式", ItemPrice: amount, ItemTaxType: "1", ItemAmount: amount }] });
  return { status: "allowance_issued", invoice_event_type: "allowance_issued", invoice_number: result.data.IA_Invoice_No || input.invoiceNo, allowance_number: result.data.IA_Allow_No, processed_at: result.data.IA_Date || new Date().toISOString(), RtnCode: result.data.RtnCode, RtnMsg: result.data.RtnMsg, provider_result: result, build_tag: ECPAY_OFFICIAL_CLIENT_BUILD_TAG };
}

export async function refundCreditCard(input: EcpayRefundInput) {
  const config = getOfficialEcpayConfig("REFUND");
  const payload: Record<string, string> = { MerchantID: config.merchantId, MerchantTradeNo: input.merchantTradeNo, TradeNo: input.tradeNo, Action: input.action || "R", TotalAmount: String(Math.round(Number(input.amount || 0))) };
  if (!payload.MerchantTradeNo || !payload.TradeNo) throw new Error("missing_merchant_trade_no_or_trade_no_for_refund");
  if (Number(payload.TotalAmount) <= 0) throw new Error("invalid_refund_amount");
  payload.CheckMacValue = createCheckMacValue(payload, config.hashKey, config.hashIV);
  const response = await fetch(paymentUrl("CreditDetail/DoAction", config), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(payload).toString() });
  const text = await response.text();
  if (!response.ok) throw new Error(`ecpay_refund_http_${response.status}: ${text}`);
  const parsed = parseFormEncodedPayload(text);
  if (String(parsed.RtnCode || "") !== "1") throw new Error(`ecpay_refund_failed: RtnCode=${parsed.RtnCode || ""}; RtnMsg=${parsed.RtnMsg || text}`);
  return { status: "refunded", refund_id: `${parsed.MerchantTradeNo || input.merchantTradeNo}:${parsed.TradeNo || input.tradeNo}:${payload.Action}:${payload.TotalAmount}`, provider_refund_id: `${parsed.TradeNo || input.tradeNo}:${payload.Action}:${payload.TotalAmount}`, TradeNo: parsed.TradeNo || input.tradeNo, MerchantTradeNo: parsed.MerchantTradeNo || input.merchantTradeNo, RtnCode: parsed.RtnCode, RtnMsg: parsed.RtnMsg, action: payload.Action, raw_payload: parsed, build_tag: ECPAY_OFFICIAL_CLIENT_BUILD_TAG };
}

export async function runSubscriptionAction(input: EcpaySubscriptionActionInput) {
  const config = getOfficialEcpayConfig("SUBSCRIPTION");
  const payload: Record<string, string> = { MerchantID: config.merchantId, MerchantTradeNo: input.merchantTradeNo, Action: input.action, TimeStamp: String(Math.floor(Date.now() / 1000)) };
  payload.CheckMacValue = createCheckMacValue(payload, config.hashKey, config.hashIV);
  const response = await fetch(paymentUrl("Cashier/CreditCardPeriodAction", config), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(payload).toString() });
  const text = await response.text();
  if (!response.ok) throw new Error(`ecpay_subscription_http_${response.status}: ${text}`);
  const parsed = parseFormEncodedPayload(text);
  if (String(parsed.RtnCode || "") !== "1") throw new Error(`ecpay_subscription_action_failed: RtnCode=${parsed.RtnCode || ""}; RtnMsg=${parsed.RtnMsg || text}`);
  return { status: "completed", task_id: `${parsed.MerchantTradeNo || input.merchantTradeNo}:${input.action}`, provider_task_id: `${parsed.MerchantTradeNo || input.merchantTradeNo}:${input.action}`, MerchantTradeNo: parsed.MerchantTradeNo || input.merchantTradeNo, RtnCode: parsed.RtnCode, RtnMsg: parsed.RtnMsg, action: input.action, raw_payload: parsed, build_tag: ECPAY_OFFICIAL_CLIENT_BUILD_TAG };
}
