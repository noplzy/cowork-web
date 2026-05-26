export type AiRuntimeConfig = {
  featureEnabled: boolean;
  globalGuideLlmEnabled: boolean;
  roomPersonalEnabled: boolean;
  sharedHostEnabled: boolean;
  roomVoiceTtsEnabled: boolean;
  bytePlusRtcStartVoiceChatEnabled: boolean;
  maxResponseChars: number;
  requestTimeoutMs: number;
  modelArk: {
    apiKey: string;
    endpointId: string;
    baseUrl: string;
    modelId: string;
  };
  seedSpeech: {
    apiKey: string;
    ttsEndpoint: string;
    ttsResourceId: string;
    ttsDefaultVoiceType: string;
    ttsVoiceTypes: Record<string, string>;
  };
  bytePlusRtc: {
    openApiEndpoint: string;
    iamAk: string;
    iamSk: string;
    rtcAppId: string;
    rtcAppKey: string;
    callbackSecret: string;
  };
};

function parseBoolean(value: string | undefined, fallback = false): boolean {
  if (value == null || value.trim() === "") {
    return fallback;
  }

  return ["1", "true", "yes", "y", "on"].includes(value.trim().toLowerCase());
}

function parseNumber(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function parseJsonObject(value: string | undefined): Record<string, string> {
  if (!value || !value.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, item]) => typeof item === "string" && item.trim().length > 0)
        .map(([key, item]) => [key, String(item).trim()])
    );
  } catch {
    return {};
  }
}

function trimEnv(name: string): string {
  return (process.env[name] || "").trim();
}

export function getAiConfig(): AiRuntimeConfig {
  const ttsVoiceTypes = parseJsonObject(process.env.BYTEPLUS_TTS_VOICE_TYPES_JSON);
  const defaultVoiceType =
    trimEnv("BYTEPLUS_TTS_DEFAULT_VOICE_TYPE") ||
    ttsVoiceTypes.default ||
    Object.values(ttsVoiceTypes)[0] ||
    "";

  return {
    featureEnabled: parseBoolean(process.env.AI_FEATURE_ENABLED, false),
    globalGuideLlmEnabled: parseBoolean(process.env.AI_GLOBAL_GUIDE_LLM_ENABLED, false),
    roomPersonalEnabled: parseBoolean(process.env.AI_ROOM_PERSONAL_ENABLED, false),
    sharedHostEnabled: parseBoolean(process.env.AI_SHARED_HOST_ENABLED, false),
    roomVoiceTtsEnabled: parseBoolean(process.env.AI_ROOM_VOICE_TTS_ENABLED, false),
    bytePlusRtcStartVoiceChatEnabled: parseBoolean(
      process.env.AI_BYTEPLUS_RTC_STARTVOICECHAT_ENABLED,
      false
    ),
    maxResponseChars: parseNumber(process.env.AI_MAX_RESPONSE_CHARS, 900, 120, 1800),
    requestTimeoutMs: parseNumber(process.env.AI_REQUEST_TIMEOUT_MS, 20000, 5000, 45000),
    modelArk: {
      apiKey: trimEnv("BYTEPLUS_MODELARK_API_KEY"),
      endpointId: trimEnv("BYTEPLUS_MODELARK_ENDPOINT_ID"),
      baseUrl: trimEnv("BYTEPLUS_MODELARK_BASE_URL") || "https://ark.ap-southeast.bytepluses.com/api/v3",
      modelId: trimEnv("BYTEPLUS_MODELARK_MODEL_ID") || "seed-2-0-lite-260228",
    },
    seedSpeech: {
      apiKey: trimEnv("BYTEPLUS_SEED_SPEECH_API_KEY"),
      ttsEndpoint:
        trimEnv("BYTEPLUS_SEED_TTS_ENDPOINT") ||
        "https://voice.ap-southeast-1.bytepluses.com/api/v3/tts/unidirectional",
      ttsResourceId: trimEnv("BYTEPLUS_TTS_RESOURCE_ID") || "seed-tts-2.0",
      ttsDefaultVoiceType: defaultVoiceType,
      ttsVoiceTypes: {
        ...ttsVoiceTypes,
        ...(defaultVoiceType ? { default: defaultVoiceType } : {}),
      },
    },
    bytePlusRtc: {
      openApiEndpoint: trimEnv("BYTEPLUS_OPENAPI_ENDPOINT") || "https://open.byteplusapi.com",
      iamAk: trimEnv("BYTEPLUS_IAM_AK"),
      iamSk: trimEnv("BYTEPLUS_IAM_SK"),
      rtcAppId: trimEnv("BYTEPLUS_RTC_APP_ID"),
      rtcAppKey: trimEnv("BYTEPLUS_RTC_APP_KEY"),
      callbackSecret: trimEnv("BYTEPLUS_CALLBACK_SECRET"),
    },
  };
}

export function getProviderReadiness(config = getAiConfig()) {
  return {
    modelArk:
      Boolean(config.modelArk.apiKey) && Boolean(config.modelArk.endpointId) && Boolean(config.modelArk.baseUrl),
    seedTts:
      Boolean(config.seedSpeech.apiKey) &&
      Boolean(config.seedSpeech.ttsResourceId) &&
      Boolean(config.seedSpeech.ttsDefaultVoiceType),
    bytePlusRtcStartVoiceChat:
      Boolean(config.bytePlusRtc.iamAk) &&
      Boolean(config.bytePlusRtc.iamSk) &&
      Boolean(config.bytePlusRtc.rtcAppId) &&
      Boolean(config.bytePlusRtc.rtcAppKey),
  };
}

export function requireAiFeature(config = getAiConfig()) {
  if (!config.featureEnabled) {
    throw new Error("AI_FEATURE_DISABLED");
  }
}
