import { fetchWithTimeout } from "@/lib/sms/http";
import {
  SendAuthSmsInput,
  SendAuthSmsSuccess,
  SmsProviderAdapter,
  SmsProviderError,
} from "@/lib/sms/provider-types";

type Every8dTokenResponse = {
  Result?: boolean;
  Msg?: string;
  Status?: string;
};

type TokenCache = {
  token: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

function getConfig() {
  return {
    uid: process.env.EVERY8D_UID?.trim() || "",
    pwd: process.env.EVERY8D_PWD?.trim() || "",
    apiBase: process.env.EVERY8D_API_BASE?.trim() || "https://api.e8d.tw",
    subject:
      process.env.EVERY8D_SMS_SUBJECT?.trim() ||
      process.env.AUTH_SMS_BRAND_NAME?.trim() ||
      "Calm&Co OTP",
    retryTimeMinutes: Number(process.env.EVERY8D_RETRYTIME_MINUTES ?? 10),
    eventId: process.env.EVERY8D_EVENT_ID?.trim() || "",
  };
}

async function getConnectionToken(timeoutMs: number): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }

  const config = getConfig();

  if (!config.uid || !config.pwd) {
    throw new SmsProviderError({
      provider: "every8d",
      code: "EVERY8D_NOT_CONFIGURED",
      message: "EVERY8D UID / PWD are missing.",
      retryable: false,
    });
  }

  const response = await fetchWithTimeout(
    "every8d",
    `${config.apiBase}/API21/HTTP/ConnectionHandler.ashx`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        HandlerType: 3,
        VerifyType: 1,
        UID: config.uid,
        PWD: config.pwd,
      }),
    },
    timeoutMs
  );

  const json = (await response.json().catch(() => null)) as Every8dTokenResponse | null;

  if (!response.ok) {
    throw new SmsProviderError({
      provider: "every8d",
      code: "EVERY8D_TOKEN_HTTP_ERROR",
      message: `EVERY8D token HTTP ${response.status}`,
      details: json,
    });
  }

  if (!json?.Result || typeof json.Msg !== "string" || !json.Msg.trim()) {
    throw new SmsProviderError({
      provider: "every8d",
      code: `EVERY8D_TOKEN_${json?.Status || "FAILED"}`,
      message: json?.Msg || "EVERY8D token request failed.",
      details: json,
    });
  }

  tokenCache = {
    token: json.Msg.trim(),
    expiresAt: Date.now() + 8 * 60 * 60 * 1000,
  };

  return tokenCache.token;
}

function normalizeSmsSendResponse(raw: string) {
  const trimmed = raw.trim();
  const parts = trimmed.split(",");

  const success = parts.length >= 5 && !trimmed.startsWith("-");

  if (!success) {
    return {
      ok: false,
      raw: trimmed,
      errorCode: parts[0] ?? "UNKNOWN",
      errorMessage: parts.slice(1).join(",") || trimmed || "EVERY8D send failed.",
      batchId: null,
    };
  }

  return {
    ok: true,
    raw: trimmed,
    errorCode: null,
    errorMessage: null,
    batchId: parts[4] ?? null,
  };
}

export const every8dSmsProvider: SmsProviderAdapter = {
  name: "every8d",
  async send(input: SendAuthSmsInput, timeoutMs: number): Promise<SendAuthSmsSuccess> {
    const config = getConfig();
    const token = await getConnectionToken(timeoutMs);

    const body = new URLSearchParams();
    body.set("SB", config.subject);
    body.set("MSG", input.message);
    body.set("DEST", input.to);
    body.set("ST", "");
    body.set("RETRYTIME", String(config.retryTimeMinutes));
    if (config.eventId) {
      body.set("EventID", config.eventId);
    }

    const response = await fetchWithTimeout(
      "every8d",
      `${config.apiBase}/API21/HTTP/SendSMS.ashx`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "text/plain, application/json",
        },
        body,
      },
      timeoutMs
    );

    const raw = await response.text();
    const parsed = normalizeSmsSendResponse(raw);

    if (!response.ok) {
      throw new SmsProviderError({
        provider: "every8d",
        code: "EVERY8D_SEND_HTTP_ERROR",
        message: `EVERY8D send HTTP ${response.status}`,
        details: raw,
      });
    }

    if (!parsed.ok) {
      throw new SmsProviderError({
        provider: "every8d",
        code: `EVERY8D_SEND_${parsed.errorCode || "FAILED"}`,
        message: parsed.errorMessage || "EVERY8D failed to enqueue the SMS message.",
        details: raw,
      });
    }

    return {
      provider: "every8d",
      providerMessageId: parsed.batchId,
      raw,
    };
  },
};
