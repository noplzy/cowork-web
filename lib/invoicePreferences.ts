export const INVOICE_PREFERENCE_BUILD_TAG = "invoice-preferences-v119-2026-06-27";

export type InvoiceKind = "personal" | "business" | "donation";
export type InvoiceCarrierKind = "ecpay" | "mobile_barcode" | "citizen_certificate" | "none";

export type InvoicePreference = {
  kind: InvoiceKind;
  buyerEmail: string;
  buyerName?: string;
  buyerPhone?: string;
  businessIdentifier?: string;
  businessName?: string;
  carrierKind: InvoiceCarrierKind;
  carrierNumber?: string;
  loveCode?: string;
  print?: "0" | "1";
  source?: string;
  buildTag?: string;
};

export type EcpayInvoicePreferenceFields = {
  customerEmail: string;
  customerPhone?: string;
  customerName?: string;
  customerIdentifier?: string;
  carrierType: string;
  carrierNum: string;
  print: "0" | "1";
  donation: "0" | "1";
  loveCode: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_BARCODE_RE = /^\/[0-9A-Z+\-.]{7}$/;
const CITIZEN_CERT_RE = /^[A-Z]{2}[0-9]{14}$/;
const BUSINESS_ID_RE = /^[0-9]{8}$/;
const LOVE_CODE_RE = /^[0-9]{3,7}$/;
const PHONE_RE = /^[0-9+\-() #]{6,20}$/;

function clean(input: unknown, max = 120) {
  return String(input ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

function normalizeEmail(input: unknown, fallbackEmail?: string) {
  const email = clean(input || fallbackEmail || "", 80).toLowerCase();
  if (!email || !EMAIL_RE.test(email)) throw new Error("請填寫有效的發票通知 Email。");
  return email;
}

function normalizeCarrierKind(input: unknown, kind: InvoiceKind): InvoiceCarrierKind {
  const value = clean(input || "", 40) as InvoiceCarrierKind;
  if (kind === "donation") return "none";
  if (["ecpay", "mobile_barcode", "citizen_certificate", "none"].includes(value)) return value;
  return "ecpay";
}

export function normalizeMobileBarcode(input: unknown) {
  const value = clean(input, 20).toUpperCase();
  if (!MOBILE_BARCODE_RE.test(value)) {
    throw new Error("手機條碼格式錯誤，需為 / 開頭共 8 碼，例如 /ABC1234。");
  }
  return value;
}

export function normalizeCitizenCertificate(input: unknown) {
  const value = clean(input, 24).toUpperCase();
  if (!CITIZEN_CERT_RE.test(value)) {
    throw new Error("自然人憑證格式錯誤，需為 2 碼大寫英文字母加 14 碼數字。");
  }
  return value;
}

export function normalizeBusinessIdentifier(input: unknown) {
  const value = clean(input, 12);
  if (!BUSINESS_ID_RE.test(value)) throw new Error("公司統一編號需為 8 碼數字。");
  return value;
}

export function normalizeLoveCode(input: unknown) {
  const value = clean(input, 10);
  if (!LOVE_CODE_RE.test(value)) throw new Error("愛心碼需為 3 到 7 碼數字。");
  return value;
}

export function normalizeInvoicePreference(input: unknown, fallbackEmail?: string): InvoicePreference {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const kind = ["personal", "business", "donation"].includes(clean(raw.kind, 20))
    ? (clean(raw.kind, 20) as InvoiceKind)
    : "personal";
  const buyerEmail = normalizeEmail(raw.buyerEmail ?? raw.email, fallbackEmail);
  const buyerName = clean(raw.buyerName ?? raw.customerName, 60) || undefined;
  const buyerPhoneRaw = clean(raw.buyerPhone ?? raw.customerPhone, 20);
  const buyerPhone = buyerPhoneRaw && PHONE_RE.test(buyerPhoneRaw) ? buyerPhoneRaw : undefined;
  const carrierKind = normalizeCarrierKind(raw.carrierKind ?? raw.carrier_type, kind);

  const base: InvoicePreference = {
    kind,
    buyerEmail,
    buyerName,
    buyerPhone,
    carrierKind,
    source: clean(raw.source || "checkout", 40),
    buildTag: INVOICE_PREFERENCE_BUILD_TAG,
  };

  if (kind === "business") {
    base.businessIdentifier = normalizeBusinessIdentifier(raw.businessIdentifier ?? raw.customerIdentifier);
    base.businessName = clean(raw.businessName ?? raw.customerName ?? raw.buyerName, 60);
    if (!base.businessName) throw new Error("公司發票需填寫公司抬頭。");
  }

  if (kind === "donation") {
    base.loveCode = normalizeLoveCode(raw.loveCode);
    base.carrierKind = "none";
    base.print = "0";
    return base;
  }

  if (carrierKind === "mobile_barcode") base.carrierNumber = normalizeMobileBarcode(raw.carrierNumber ?? raw.carrierNum);
  if (carrierKind === "citizen_certificate") base.carrierNumber = normalizeCitizenCertificate(raw.carrierNumber ?? raw.carrierNum);
  if (carrierKind === "none") base.print = kind === "business" ? "1" : "0";
  else base.print = "0";

  return base;
}

export function toEcpayInvoiceFields(preference: InvoicePreference): EcpayInvoicePreferenceFields {
  if (preference.kind === "donation") {
    return {
      customerEmail: preference.buyerEmail,
      customerPhone: preference.buyerPhone,
      customerName: preference.buyerName || "",
      customerIdentifier: "",
      carrierType: "",
      carrierNum: "",
      print: "0",
      donation: "1",
      loveCode: preference.loveCode || "",
    };
  }

  let carrierType = "1";
  let carrierNum = "";
  if (preference.carrierKind === "mobile_barcode") {
    carrierType = "3";
    carrierNum = preference.carrierNumber || "";
  } else if (preference.carrierKind === "citizen_certificate") {
    carrierType = "2";
    carrierNum = preference.carrierNumber || "";
  } else if (preference.carrierKind === "none") {
    carrierType = preference.kind === "business" ? "" : "1";
    carrierNum = "";
  }

  return {
    customerEmail: preference.buyerEmail,
    customerPhone: preference.buyerPhone,
    customerName: preference.kind === "business" ? preference.businessName || preference.buyerName || "" : preference.buyerName || "",
    customerIdentifier: preference.kind === "business" ? preference.businessIdentifier || "" : "",
    carrierType,
    carrierNum,
    print: preference.print || (carrierType ? "0" : preference.kind === "business" ? "1" : "0"),
    donation: "0",
    loveCode: "",
  };
}

export function buildDefaultInvoicePreference(email?: string): InvoicePreference {
  return normalizeInvoicePreference({ kind: "personal", carrierKind: "ecpay", buyerEmail: email || "" }, email);
}
