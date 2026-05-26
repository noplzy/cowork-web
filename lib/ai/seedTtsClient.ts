import { getAiConfig } from "@/lib/ai/aiConfig";

export type SeedTtsResult =
  | {
      kind: "audio";
      contentType: string;
      audio: ArrayBuffer;
      providerRequestId: string | null;
    }
  | {
      kind: "json";
      json: unknown;
      providerRequestId: string | null;
    };

export class SeedTtsClientError extends Error {
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
    this.name = "SeedTtsClientError";
    this.status = params.status;
    this.providerCode = params.providerCode ?? null;
    this.providerRequestId = params.providerRequestId ?? null;
    this.raw = params.raw;
  }
}

function withTimeout(timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    done: () => clearTimeout(timeout),
  };
}

function safeRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `calmco-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function resolveTtsVoiceType(input?: string | null): string {
  const config = getAiConfig();
  const normalized = (input || "").trim();
  if (!normalized) {
    return config.seedSpeech.ttsDefaultVoiceType;
  }

  const allowed = Object.values(config.seedSpeech.ttsVoiceTypes);
  if (allowed.length > 0 && !allowed.includes(normalized)) {
    return config.seedSpeech.ttsDefaultVoiceType;
  }

  return normalized;
}

export async function synthesizeSeedTts(params: {
  text: string;
  voiceType?: string | null;
  format?: "mp3" | "wav";
  sampleRate?: number;
}): Promise<SeedTtsResult> {
  const config = getAiConfig();
  if (!config.seedSpeech.apiKey) {
    throw new Error("Missing BYTEPLUS_SEED_SPEECH_API_KEY");
  }
  if (!config.seedSpeech.ttsResourceId) {
    throw new Error("Missing BYTEPLUS_TTS_RESOURCE_ID");
  }

  const voiceType = resolveTtsVoiceType(params.voiceType);
  if (!voiceType) {
    throw new Error("Missing BYTEPLUS_TTS_DEFAULT_VOICE_TYPE");
  }

  const timer = withTimeout(config.requestTimeoutMs);

  try {
    const response = await fetch(config.seedSpeech.ttsEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": config.seedSpeech.apiKey,
        "X-Api-Resource-Id": config.seedSpeech.ttsResourceId,
        "X-Api-Request-Id": safeRequestId(),
      },
      body: JSON.stringify({
        req_params: {
          text: params.text,
          speaker: voiceType,
          additions: JSON.stringify({
            disable_markdown_filter: true,
            enable_language_detector: true,
            enable_latex_tn: false,
          }),
          audio_params: {
            format: params.format ?? "mp3",
            sample_rate: params.sampleRate ?? 24000,
          },
        },
      }),
      signal: timer.signal,
    });

    const providerRequestId =
      response.headers.get("x-request-id") ||
      response.headers.get("x-tt-logid") ||
      response.headers.get("x-volc-request-id") ||
      null;
    const contentType = response.headers.get("content-type") || "application/octet-stream";

    if (!response.ok) {
      const raw = contentType.includes("application/json")
        ? await response.json().catch(() => null)
        : await response.text().catch(() => "");
      throw new SeedTtsClientError({
        message:
          (raw as any)?.error?.message ||
          (raw as any)?.message ||
          "SeedTTS request failed",
        status: response.status,
        providerCode: (raw as any)?.error?.code || (raw as any)?.code || null,
        providerRequestId,
        raw,
      });
    }

    if (contentType.includes("application/json")) {
      const json = await response.json();
      return { kind: "json", json, providerRequestId };
    }

    return {
      kind: "audio",
      contentType,
      audio: await response.arrayBuffer(),
      providerRequestId,
    };
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new SeedTtsClientError({
        message: "SeedTTS request timeout",
        status: 408,
        providerCode: "TIMEOUT",
      });
    }

    throw error;
  } finally {
    timer.done();
  }
}
