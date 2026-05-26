import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAiConfig, requireAiFeature } from "@/lib/ai/aiConfig";
import { buildSharedHostMessages, clampAssistantText } from "@/lib/ai/aiPromptPolicy";
import { estimateHostCreditUsed, hostActionLabel, normalizeSharedHostAction } from "@/lib/ai/hostPolicyEngine";
import { logAiProviderError, logAiUsageEvent } from "@/lib/ai/aiUsageLogger";
import { ModelArkClientError, callModelArkText } from "@/lib/ai/modelArkClient";
import { AiRoomAccessError, getAiRoomContextFromRequest } from "@/lib/ai/roomAccess";

export const runtime = "nodejs";

type Body = {
  roomId?: string;
  action?: string;
};

export async function POST(req: Request) {
  const config = getAiConfig();

  try {
    requireAiFeature(config);
    if (!config.sharedHostEnabled) {
      return NextResponse.json({ error: "Shared Host AI is disabled" }, { status: 403 });
    }

    const body = (await req.json()) as Body;
    const roomId = (body.roomId || "").trim();
    const action = normalizeSharedHostAction(body.action);
    const context = await getAiRoomContextFromRequest(req, roomId);

    const messages = buildSharedHostMessages({
      room: {
        title: context.room.title,
        roomCategory: context.room.room_category,
        interactionStyle: context.room.interaction_style,
        durationMinutes: context.room.duration_minutes,
        mode: context.room.mode,
      },
      action,
    });

    const result = await callModelArkText({
      messages,
      temperature: 0.58,
      topP: 0.8,
      maxTokens: 520,
    });

    const suggestion = clampAssistantText(result.text, config.maxResponseChars);
    const hostCreditUsed = estimateHostCreditUsed(action);
    const hostSessionId = `host_${context.room.id}_${Date.now()}`;

    const sessionInsert = await supabaseAdmin
      .from("ai_room_host_sessions")
      .insert({
        room_id: context.room.id,
        host_session_id: hostSessionId,
        status: "active",
        payer_user_id: context.userId,
        benefited_user_ids: [context.userId],
        host_credit_budget: 0,
        host_credit_used: hostCreditUsed,
        provider: "byteplus-modelark",
        provider_session_id: result.providerRequestId,
        config: {
          action,
          action_label: hostActionLabel(action),
          model_endpoint_id: config.modelArk.endpointId,
          textStored: false,
        },
        summary_json: {
          output_chars: suggestion.length,
        },
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (sessionInsert.error) {
      throw new Error(`AI host session log failed: ${sessionInsert.error.message}`);
    }

    const usageEventId = await logAiUsageEvent({
      roomId: context.room.id,
      userId: context.userId,
      aiMode: "room-host",
      eventType: "host_intervention",
      sessionId: hostSessionId,
      payerUserId: context.userId,
      benefitedUserIds: [context.userId],
      provider: "byteplus-modelark",
      providerModel: config.modelArk.endpointId,
      providerRequestId: result.providerRequestId,
      hostCreditUsed,
      inputChars: action.length,
      outputChars: suggestion.length,
      roomCategory: context.room.room_category,
      interactionStyle: context.room.interaction_style,
      baseDurationMinutes: context.room.duration_minutes,
      metadata: {
        action,
        action_label: hostActionLabel(action),
        ai_room_host_session_id: sessionInsert.data?.id,
        rawId: result.rawId,
        textStored: false,
      },
    });

    return NextResponse.json({
      ok: true,
      mode: "room-host",
      action,
      actionLabel: hostActionLabel(action),
      suggestion,
      hostSessionId,
      aiRoomHostSessionId: sessionInsert.data?.id,
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
        aiMode: "room-host",
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
