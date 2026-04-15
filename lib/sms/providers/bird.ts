import { fetchWithTimeout } from "@/lib/sms/http";
import {
  SendAuthSmsInput,
  SendAuthSmsSuccess,
  SmsProviderAdapter,
  SmsProviderError,
} from "@/lib/sms/provider-types";

function getConfig() {
  return {
    accessKey: process.env.BIRD_ACCESS_KEY?.trim() || "",
    workspaceId: process.env.BIRD_WORKSPACE_ID?.trim() || "",
    channelId: process.env.BIRD_CHANNEL_ID?.trim() || "",
    apiBase: process.env.BIRD_API_BASE?.trim() || "https://api.bird.com",
  };
}

export const birdSmsProvider: SmsProviderAdapter = {
  name: "bird",
  async send(input: SendAuthSmsInput, timeoutMs: number): Promise<SendAuthSmsSuccess> {
    const config = getConfig();

    if (!config.accessKey || !config.workspaceId || !config.channelId) {
      throw new SmsProviderError({
        provider: "bird",
        code: "BIRD_NOT_CONFIGURED",
        message: "Bird credentials are missing.",
        retryable: false,
      });
    }

    const response = await fetchWithTimeout(
      "bird",
      `${config.apiBase}/workspaces/${encodeURIComponent(config.workspaceId)}/channels/${encodeURIComponent(
        config.channelId
      )}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `AccessKey ${config.accessKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          receiver: {
            contacts: [
              {
                identifierValue: input.to,
              },
            ],
          },
          body: {
            type: "text",
            text: {
              text: input.message,
            },
          },
        }),
      },
      timeoutMs
    );

    const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (!response.ok) {
      throw new SmsProviderError({
        provider: "bird",
        code: "BIRD_HTTP_ERROR",
        message: `Bird HTTP ${response.status}`,
        details: json,
      });
    }

    const messageId = typeof json?.id === "string" ? json.id : null;
    if (!messageId) {
      throw new SmsProviderError({
        provider: "bird",
        code: "BIRD_EMPTY_RESPONSE",
        message: "Bird accepted the request but returned no message id.",
        details: json,
      });
    }

    return {
      provider: "bird",
      providerMessageId: messageId,
      raw: json,
    };
  },
};
