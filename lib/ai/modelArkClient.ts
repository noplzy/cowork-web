import { getAiConfig } from "@/lib/ai/aiConfig";

export type ModelArkRole = "system" | "user" | "assistant";

export type ModelArkMessage = {
  role: ModelArkRole;
  content: string;
};

export type ModelArkTextResult = {
  text: string;
  providerRequestId: string | null;
  rawId: string | null;
};

export class ModelArkClientError extends Error {
  status: number;
  providerCode: string | null;
  providerRequestId: string | null;
  raw: unknown;

  constructor(params: {
    message: string;
    status: number;
    providerCode?: string | null;
    providerRequestId?: string | null;
    raw?: unknown;
  }) {
    super(params.message);
    this.name = "ModelArkClientError";
    this.status = params.status;
    this.providerCode = params.providerCode ?? null;
    this.providerRequestId = params.providerRequestId ?? null;
    this.raw = params.raw;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/g, "");
}

function withTimeout(timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    done: () => clearTimeout(timeout),
  };
}

function extractText(json: any): string {
  const chatText = json?.choices?.[0]?.message?.content;
  if (typeof chatText === "string" && chatText.trim()) {
    return chatText.trim();
  }

  const outputText = json?.output_text;
  if (typeof outputText === "string" && outputText.trim()) {
    return outputText.trim();
  }

  const responseOutput = json?.output;
  if (Array.isArray(responseOutput)) {
    const parts: string[] = [];
    for (const item of responseOutput) {
      if (Array.isArray(item?.content)) {
        for (const content of item.content) {
          if (typeof content?.text === "string") {
            parts.push(content.text);
          }
        }
      }
    }

    const joined = parts.join("\n").trim();
    if (joined) {
      return joined;
    }
  }

  return "";
}

export async function callModelArkText(params: {
  messages: ModelArkMessage[];
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}): Promise<ModelArkTextResult> {
  const config = getAiConfig();
  if (!config.modelArk.apiKey) {
    throw new Error("Missing BYTEPLUS_MODELARK_API_KEY");
  }
  if (!config.modelArk.endpointId) {
    throw new Error("Missing BYTEPLUS_MODELARK_ENDPOINT_ID");
  }

  const timer = withTimeout(config.requestTimeoutMs);
  const url = `${normalizeBaseUrl(config.modelArk.baseUrl)}/chat/completions`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.modelArk.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.modelArk.endpointId,
        messages: params.messages,
        stream: false,
        temperature: params.temperature ?? 0.65,
        top_p: params.topP ?? 0.8,
        max_tokens: params.maxTokens ?? 512,
      }),
      signal: timer.signal,
    });

    const providerRequestId =
      response.headers.get("x-request-id") ||
      response.headers.get("x-tt-logid") ||
      response.headers.get("x-volc-request-id") ||
      null;

    const json = await response.json().catch(async () => ({ raw: await response.text().catch(() => "") }));

    if (!response.ok) {
      throw new ModelArkClientError({
        message: json?.error?.message || json?.message || "ModelArk request failed",
        status: response.status,
        providerCode: json?.error?.code || json?.code || null,
        providerRequestId,
        raw: json,
      });
    }

    const text = extractText(json);
    if (!text) {
      throw new ModelArkClientError({
        message: "ModelArk response text missing",
        status: response.status,
        providerRequestId,
        raw: json,
      });
    }

    return {
      text,
      providerRequestId,
      rawId: typeof json?.id === "string" ? json.id : null,
    };
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new ModelArkClientError({
        message: "ModelArk request timeout",
        status: 408,
        providerCode: "TIMEOUT",
      });
    }

    throw error;
  } finally {
    timer.done();
  }
}
