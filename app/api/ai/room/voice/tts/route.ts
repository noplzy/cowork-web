import { NextResponse } from "next/server";
import { getAiConfig, requireAiFeature } from "@/lib/ai/aiConfig";
import { clampUserText } from "@/lib/ai/aiPromptPolicy";
import { logAiProviderError, logAiUsageEvent } from "@/lib/ai/aiUsageLogger";
import { SeedTtsClientError, resolveTtsVoiceType, synthesizeSeedTts } from "@/lib/ai/seedTtsClient";
import { AiRoomAccessError, getAiRoomContextFromRequest } from "@/lib/ai/roomAccess";

export const runtime = "nodejs";

type Body = {
  roomId?: string;
  text?: string;
  voiceType?: string;
};

export async function POST(req: Request) {
  const config = getAiConfig();

  try {
    requireAiFeature(config);
    if (!config.roomVoiceTtsEnabled) {
      return NextResponse.json({ error: "Room voice TTS is disabled" }, { status: 403 });
    }

    const body = (await req.json()) as Body;
    const roomId = (body.roomId || "").trim();
    const text = clampUserText(body.text || "", config.maxResponseChars);
    const voiceType = resolveTtsVoiceType(body.voiceType);

    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const context = await getAiRoomContextFromRequest(req, roomId);
    await logAiUsageEvent({
      roomId: context.room.id,
      userId: context.userId,
      aiMode: "room-personal",
      eventType: "tts_start",
      provider: "byteplus-seedtts",
      providerModel: config.seedSpeech.ttsResourceId,
      inputChars: text.length,
      roomCategory: context.room.room_category,
      interactionStyle: context.room.interaction_style,
      baseDurationMinutes: context.room.duration_minutes,
      metadata: {
        voiceType,
        audioStored: false,
        textStored: false,
      },
    });

    const result = await synthesizeSeedTts({ text, voiceType });
    const usageEventId = await logAiUsageEvent({
      roomId: context.room.id,
      userId: context.userId,
      aiMode: "room-personal",
      eventType: "tts_end",
      provider: "byteplus-seedtts",
      providerModel: config.seedSpeech.ttsResourceId,
      providerRequestId: result.providerRequestId,
      inputChars: text.length,
      roomCategory: context.room.room_category,
      interactionStyle: context.room.interaction_style,
      baseDurationMinutes: context.room.duration_minutes,
      metadata: {
        voiceType,
        resultKind: result.kind,
        audioStored: false,
        textStored: false,
      },
    });

    if (result.kind === "json") {
      return NextResponse.json({
        ok: true,
        usageEventId,
        providerRequestId: result.providerRequestId,
        result: result.json,
      });
    }

    return new Response(result.audio, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "no-store",
        "X-AI-Usage-Event-Id": usageEventId || "",
        "X-Provider-Request-Id": result.providerRequestId || "",
      },
    });
  } catch (error: any) {
    if (error instanceof AiRoomAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const isFeatureDisabled = error?.message === "AI_FEATURE_DISABLED";
    if (isFeatureDisabled) {
      return NextResponse.json({ error: "AI feature is disabled" }, { status: 403 });
    }

    if (error instanceof SeedTtsClientError) {
      await logAiProviderError({
        aiMode: "room-personal",
        provider: "byteplus-seedtts",
        providerModel: config.seedSpeech.ttsResourceId,
        providerRequestId: error.providerRequestId,
        providerErrorCode: error.providerCode,
        message: error.message,
        metadata: { status: error.status },
      }).catch(() => null);

      return NextResponse.json(
        {
          error: "SeedTTS request failed",
          detail: error.message,
          providerCode: error.providerCode,
          providerRequestId: error.providerRequestId,
        },
        { status: error.status || 502 }
      );
    }

    return NextResponse.json({ error: error?.message || "Unexpected server error" }, { status: 500 });
  }
}
