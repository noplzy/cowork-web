import crypto from "node:crypto";

export type EcpayConfig = {
  merchantId: string;
  hashKey: string;
  hashIV: string;
  stage: boolean;
  checkoutUrl: string;
  queryUrl: string;
};

export type StringLike = string | number | boolean;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function parseStageFlag(value: string | undefined): boolean {
  const normalized = String(value || "").trim().toLowerCase();
  return ["true", "1", "test", "stage", "staging"].includes(normalized);
}

export function getEcpayConfig(): EcpayConfig {
  const merchantId = requireEnv("ECPAY_MERCHANT_ID");
  const hashKey = requireEnv("ECPAY_HASH_KEY");
  const hashIV = requireEnv("ECPAY_HASH_IV");
  const stage = parseStageFlag(process.env.ECPAY_STAGE);

  return {
    merchantId,
    hashKey,
    hashIV,
    stage,
    checkoutUrl: stage
      ? "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5"
      : "https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5",
    queryUrl: stage
      ? "https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5"
      : "https://payment.ecpay.com.tw/Cashier/QueryTradeInfo/V5",
  };
}

export function formatTradeDate(date = new Date()): string {
  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const HH = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}/${MM}/${dd} ${HH}:${mm}:${ss}`;
}

const TRADE_NO_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function generateMerchantTradeNo(prefix = "VIP"): string {
  const baseTs = Date.now().toString();
  let randomPart = "";
  while (randomPart.length < 20) {
    randomPart += TRADE_NO_CHARS[Math.floor(Math.random() * TRADE_NO_CHARS.length)];
  }
  const raw = `${prefix}${baseTs}${randomPart}`.replace(/[^A-Za-z0-9]/g, "");
  return raw.slice(0, 20);
}

function normalizeForMac(value: StringLike): string {
  return String(value);
}

function ecpayUrlEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, "+")
    .replace(/%2D/gi, "-")
    .replace(/%5F/gi, "_")
    .replace(/%2E/gi, ".")
    .replace(/%21/gi, "!")
    .replace(/%2A/gi, "*")
    .replace(/%28/gi, "(")
    .replace(/%29/gi, ")")
    .toLowerCase();
}

/**
 * IMPORTANT:
 * - For outbound create-order requests: only include fields you actually send to ECPay.
 * - For inbound callback verification: keep empty-string fields if ECPay sent them.
 *   (e.g. StoreID=, CustomField1=, CustomField2= ... must stay in checksum input)
 */
export function createCheckMacValue(
  input: Record<string, StringLike | undefined | null>,
  hashKey: string,
  hashIV: string,
): string {
  const entries = Object.entries(input)
    .filter(([key, value]) => key !== "CheckMacValue" && value !== undefined && value !== null)
    .map(([key, value]) => [key, normalizeForMac(value as StringLike)] as const)
    .sort(([a], [b]) => a.localeCompare(b));

  const raw = entries.map(([key, value]) => `${key}=${value}`).join("&");
  const source = `HashKey=${hashKey}&${raw}&HashIV=${hashIV}`;
  const encoded = ecpayUrlEncode(source);
  return crypto.createHash("sha256").update(encoded).digest("hex").toUpperCase();
}

export function verifyCheckMacValue(
  input: Record<string, string | undefined>,
  hashKey: string,
  hashIV: string,
): boolean {
  const provided = String(input.CheckMacValue || "").toUpperCase();
  if (!provided) return false;
  const expected = createCheckMacValue(input, hashKey, hashIV);
  return provided === expected;
}

export function buildExpectedCheckMacValue(
  input: Record<string, string | undefined>,
  hashKey: string,
  hashIV: string,
): string {
  return createCheckMacValue(input, hashKey, hashIV);
}

export function parseFormEncodedPayload(raw: string): Record<string, string> {
  const params = new URLSearchParams(raw);
  const record: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    record[key] = value;
  }
  return record;
}

export async function queryEcpayTradeInfo(
  merchantTradeNo: string,
  config: EcpayConfig,
): Promise<Record<string, string>> {
  const payload: Record<string, string> = {
    MerchantID: config.merchantId,
    MerchantTradeNo: merchantTradeNo,
    TimeStamp: String(Math.floor(Date.now() / 1000)),
  };
  payload.CheckMacValue = createCheckMacValue(payload, config.hashKey, config.hashIV);

  const body = new URLSearchParams(payload).toString();
  const response = await fetch(config.queryUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`ECPay query failed (${response.status}): ${text}`);
  }

  const parsed = parseFormEncodedPayload(text);
  if (!verifyCheckMacValue(parsed, config.hashKey, config.hashIV)) {
    throw new Error("ECPay query CheckMacValue verification failed");
  }

  return parsed;
}
