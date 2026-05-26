import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type AiUsageLogInput = {
  roomId?: string | null;
  userId?: string | null;
  aiMode: "global-guide" | "room-personal" | "room-host";
  eventType: "session_start" | "session_end" | "message" | "host_intervention" | "tts_start" | "tts_end" | "error";
  sessionId?: string | null;
  payerUserId?: string | null;
  benefitedUserIds?: string[];
  provider?: string | null;
  providerModel?: string | null;
  providerRequestId?: string | null;
  hostCreditUsed?: number;
  sharedHostActiveSeconds?: number;
  personalAiTextEvents?: number;
  personalAiActiveSeconds?: number;
  presenceMode?: "quiet" | "audio" | "mosaic" | "camera" | null;
  roomCategory?: string | null;
  interactionStyle?: string | null;
  baseDurationMinutes?: number | null;
  inputChars?: number;
  outputChars?: number;
  providerCostEstimateTwd?: number | null;
  providerErrorCode?: string | null;
  stopReason?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logAiUsageEvent(input: AiUsageLogInput): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("ai_usage_events")
    .insert({
      room_id: input.roomId ?? null,
      user_id: input.userId ?? null,
      ai_mode: input.aiMode,
      event_type: input.eventType,
      session_id: input.sessionId ?? null,
      payer_user_id: input.payerUserId ?? input.userId ?? null,
      benefited_user_ids: input.benefitedUserIds ?? (input.userId ? [input.userId] : []),
      provider: input.provider ?? null,
      provider_model: input.providerModel ?? null,
      provider_request_id: input.providerRequestId ?? null,
      host_credit_used: input.hostCreditUsed ?? 0,
      shared_host_active_seconds: input.sharedHostActiveSeconds ?? 0,
      personal_ai_text_events: input.personalAiTextEvents ?? 0,
      personal_ai_active_seconds: input.personalAiActiveSeconds ?? 0,
      presence_mode: input.presenceMode ?? null,
      room_category: input.roomCategory ?? null,
      interaction_style: input.interactionStyle ?? null,
      base_duration_minutes: input.baseDurationMinutes ?? null,
      input_chars: input.inputChars ?? 0,
      output_chars: input.outputChars ?? 0,
      provider_cost_estimate_twd: input.providerCostEstimateTwd ?? null,
      provider_error_code: input.providerErrorCode ?? null,
      stop_reason: input.stopReason ?? null,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`AI usage log failed: ${error.message}`);
  }

  return data?.id ?? null;
}

export async function logAiProviderError(input: {
  roomId?: string | null;
  userId?: string | null;
  aiMode: "global-guide" | "room-personal" | "room-host";
  provider?: string | null;
  providerModel?: string | null;
  providerRequestId?: string | null;
  providerErrorCode?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  return logAiUsageEvent({
    roomId: input.roomId,
    userId: input.userId,
    aiMode: input.aiMode,
    eventType: "error",
    provider: input.provider,
    providerModel: input.providerModel,
    providerRequestId: input.providerRequestId,
    providerErrorCode: input.providerErrorCode,
    stopReason: input.message.slice(0, 200),
    metadata: input.metadata,
  });
}
