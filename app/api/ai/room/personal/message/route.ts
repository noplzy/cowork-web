import { NextResponse } from "next/server";
import { getAiConfig, requireAiFeature } from "@/lib/ai/aiConfig";
import { clampAssistantText, clampUserText, buildPersonalRoomMessages, type PersonalRoomIntent } from "@/lib/ai/aiPromptPolicy";
import { logAiProviderError, logAiUsageEvent } from "@/lib/ai/aiUsageLogger";
import { ModelArkClientError, callModelArkText } from "@/lib/ai/modelArkClient";
import { AiRoomAccessError, getAiRoomContextFromRequest } from "@/lib/ai/roomAccess";

export const runtime = "nodejs";

type Body = {
  roomId?: string;
  message?: string;
  intent?: PersonalRoomIntent;
};

function normalizeIntent(value?: string | null): PersonalRoomIntent {
  if (value === "start" || value === "stuck" || value === "wrapup" || value === "general") {
    return value;
  }

  return "general";
}

export async function POST(req: Request) {
  const config = getAiConfig();

  try {
    requireAiFeature(config);
    if (!config.roomPersonalEnabled) {
      return NextResponse.json({ error: "Room personal AI is disabled" }, { status: 403 });
    }

    const body = (await req.json()) as Body;
    const roomId = (body.roomId || "").trim();
    const userText = clampUserText(body.message || "", 900);
    const intent = normalizeIntent(body.intent);

    if (!userText) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    const context = await getAiRoomContextFromRequest(req, roomId);
    const messages = buildPersonalRoomMessages({
      room: {
        title: context.room.title,
        roomCategory: context.room.room_category,
        interactionStyle: context.room.interaction_style,
        durationMinutes: context.room.duration_minutes,
        mode: context.room.mode,
      },
      message: userText,
      intent,
    });

    const result = await callModelArkText({
      messages,
      temperature: 0.62,
      topP: 0.8,
      maxTokens: 420,
    });

    const reply = clampAssistantText(result.text, config.maxResponseChars);
    const usageEventId = await logAiUsageEvent({
      roomId: context.room.id,
      userId: context.userId,
      aiMode: "room-personal",
      eventType: "message",
      provider: "byteplus-modelark",
      providerModel: config.modelArk.endpointId,
      providerRequestId: result.providerRequestId,
      personalAiTextEvents: 1,
      inputChars: userText.length,
      outputChars: reply.length,
      roomCategory: context.room.room_category,
      interactionStyle: context.room.interaction_style,
      baseDurationMinutes: context.room.duration_minutes,
      metadata: {
        intent,
        rawId: result.rawId,
        textStored: false,
      },
    });

    return NextResponse.json({
      ok: true,
      mode: "room-personal",
      intent,
      reply,
      usageEventId,
      providerRequestId: result.providerRequestId,
    });
  } catch (error: any) {
    if (error instanceof AiRoomAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const isFeatureDisabled = error?.message === "AI_FEATURE_DISABLED";
    if (isFeatureDisabled) {
      return NextResponse.json({ error: "AI feature is disabled" }, { status: 403 });
    }

    if (error instanceof ModelArkClientError) {
      await logAiProviderError({
        aiMode: "room-personal",
        provider: "byteplus-modelark",
        providerModel: config.modelArk.endpointId,
        providerRequestId: error.providerRequestId,
        providerErrorCode: error.providerCode,
        message: error.message,
        metadata: { status: error.status },
      }).catch(() => null);

      return NextResponse.json(
        {
          error: "ModelArk request failed",
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
