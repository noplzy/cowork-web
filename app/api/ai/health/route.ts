import { NextResponse } from "next/server";
import { getAiConfig, getProviderReadiness } from "@/lib/ai/aiConfig";

export const runtime = "nodejs";

export async function GET() {
  const config = getAiConfig();
  const readiness = getProviderReadiness(config);

  return NextResponse.json({
    ok: true,
    featureEnabled: config.featureEnabled,
    globalGuideLlmEnabled: config.globalGuideLlmEnabled,
    roomPersonalEnabled: config.roomPersonalEnabled,
    sharedHostEnabled: config.sharedHostEnabled,
    roomVoiceTtsEnabled: config.roomVoiceTtsEnabled,
    bytePlusRtcStartVoiceChatEnabled: config.bytePlusRtcStartVoiceChatEnabled,
    readiness,
    modelArk: {
      configured: readiness.modelArk,
      baseUrlConfigured: Boolean(config.modelArk.baseUrl),
      endpointConfigured: Boolean(config.modelArk.endpointId),
      modelId: config.modelArk.modelId,
    },
    seedSpeech: {
      ttsConfigured: readiness.seedTts,
      ttsResourceId: config.seedSpeech.ttsResourceId || null,
      defaultVoiceConfigured: Boolean(config.seedSpeech.ttsDefaultVoiceType),
      availableVoiceKeys: Object.keys(config.seedSpeech.ttsVoiceTypes),
    },
    bytePlusRtc: {
      startVoiceChatConfigured: readiness.bytePlusRtcStartVoiceChat,
      openApiEndpointConfigured: Boolean(config.bytePlusRtc.openApiEndpoint),
      callbackSecretConfigured: Boolean(config.bytePlusRtc.callbackSecret),
    },
  });
}
