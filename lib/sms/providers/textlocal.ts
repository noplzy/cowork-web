import { fetchWithTimeout } from "@/lib/sms/http";
import {
  SendAuthSmsInput,
  SendAuthSmsSuccess,
  SmsProviderAdapter,
  SmsProviderError,
} from "@/lib/sms/provider-types";

function getConfig() {
  return {
    apiKey: process.env.TEXTLOCAL_API_KEY?.trim() || "",
    sender: process.env.TEXTLOCAL_SENDER?.trim() || process.env.AUTH_SMS_BRAND_NAME?.trim() || "",
    apiBase: process.env.TEXTLOCAL_API_BASE?.trim() || "https://api.txtlocal.com",
  };
}

export const textlocalSmsProvider: SmsProviderAdapter = {
  name: "textlocal",
  async send(input: SendAuthSmsInput, timeoutMs: number): Promise<SendAuthSmsSuccess> {
    const config = getConfig();

    if (!config.apiKey) {
      throw new SmsProviderError({
        provider: "textlocal",
        code: "TEXTLOCAL_NOT_CONFIGURED",
        message: "Textlocal API key is missing.",
        retryable: false,
      });
    }

    const body = new URLSearchParams();
    body.set("apikey", config.apiKey);
    body.set("numbers", input.to.replace(/^\+/, ""));
    body.set("message", input.message);
    if (config.sender) {
      body.set("sender", config.sender);
    }

    const response = await fetchWithTimeout(
      "textlocal",
      `${config.apiBase}/send/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body,
      },
      timeoutMs
    );

    const json = (await response.json().catch(() => null)) as
      | {
          status?: string;
          messages?: Array<Record<string, unknown>>;
          errors?: Array<Record<string, unknown>>;
        }
      | null;

    if (!response.ok) {
      throw new SmsProviderError({
        provider: "textlocal",
        code: "TEXTLOCAL_HTTP_ERROR",
        message: `Textlocal HTTP ${response.status}`,
        details: json,
      });
    }

    if (json?.status !== "success") {
      const firstError = json?.errors?.[0];
      throw new SmsProviderError({
        provider: "textlocal",
        code:
          typeof firstError?.code === "number"
            ? `TEXTLOCAL_ERROR_${firstError.code}`
            : "TEXTLOCAL_SEND_FAILED",
        message:
          typeof firstError?.message === "string"
            ? firstError.message
            : "Textlocal failed to enqueue the SMS message.",
        details: json,
      });
    }

    const firstMessage = json?.messages?.[0];
    const messageId =
      typeof firstMessage?.id === "string" || typeof firstMessage?.id === "number"
        ? String(firstMessage.id)
        : null;

    return {
      provider: "textlocal",
      providerMessageId: messageId,
      raw: json,
    };
  },
};
