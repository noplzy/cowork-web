import { fetchWithTimeout } from "@/lib/sms/http";
import {
  SendAuthSmsInput,
  SendAuthSmsSuccess,
  SmsProviderAdapter,
  SmsProviderError,
} from "@/lib/sms/provider-types";

function getConfig() {
  return {
    apiKey: process.env.VONAGE_API_KEY?.trim() || "",
    apiSecret: process.env.VONAGE_API_SECRET?.trim() || "",
    from: process.env.VONAGE_SMS_FROM?.trim() || process.env.AUTH_SMS_BRAND_NAME?.trim() || "CalmCo",
    apiBase: process.env.VONAGE_SMS_API_BASE?.trim() || "https://rest.nexmo.com",
  };
}

export const vonageSmsProvider: SmsProviderAdapter = {
  name: "vonage",
  async send(input: SendAuthSmsInput, timeoutMs: number): Promise<SendAuthSmsSuccess> {
    const config = getConfig();

    if (!config.apiKey || !config.apiSecret) {
      throw new SmsProviderError({
        provider: "vonage",
        code: "VONAGE_NOT_CONFIGURED",
        message: "Vonage credentials are missing.",
        retryable: false,
      });
    }

    const body = new URLSearchParams();
    body.set("from", config.from);
    body.set("to", input.to);
    body.set("text", input.message);

    const auth = Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64");

    const response = await fetchWithTimeout(
      "vonage",
      `${config.apiBase}/sms/json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body,
      },
      timeoutMs
    );

    const json = (await response.json().catch(() => null)) as
      | {
          messages?: Array<Record<string, unknown>>;
        }
      | null;

    if (!response.ok) {
      throw new SmsProviderError({
        provider: "vonage",
        code: "VONAGE_HTTP_ERROR",
        message: `Vonage HTTP ${response.status}`,
        details: json,
      });
    }

    const firstMessage = json?.messages?.[0];
    if (!firstMessage) {
      throw new SmsProviderError({
        provider: "vonage",
        code: "VONAGE_EMPTY_RESPONSE",
        message: "Vonage returned no message payload.",
        details: json,
      });
    }

    const status = String(firstMessage["status"] ?? "");
    if (status !== "0") {
      throw new SmsProviderError({
        provider: "vonage",
        code: `VONAGE_STATUS_${status || "UNKNOWN"}`,
        message:
          String(firstMessage["error-text"] ?? "") ||
          "Vonage failed to enqueue the SMS message.",
        details: firstMessage,
      });
    }

    return {
      provider: "vonage",
      providerMessageId:
        typeof firstMessage["message-id"] === "string" ? firstMessage["message-id"] : null,
      raw: json,
    };
  },
};
