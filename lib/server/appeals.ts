import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanText } from "@/lib/server/safety";
import {
  APPEAL_REASON_CODES,
  assertAppealReasonCode,
  assertAppealTransition,
  type AppealStatus,
} from "@/lib/server/trustOps";

export const APPEALS_BUILD_TAG = "appeals-lifecycle-v129-2026-07-18";

export type CreateAppealInput = {
  userId: string;
  moderationCaseId?: string | null;
  moderationActionId?: string | null;
  reasonCode?: string | null;
  message: string;
  requestedOutcome?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
};

export type AppealDecisionInput = {
  appealId: string;
  adminUserId: string;
  status: AppealStatus;
  adminResponse?: string | null;
  decisionReason?: string | null;
  createRestoreAction?: boolean;
  metadata?: Record<string, unknown>;
};

function rpcError(error: { message?: string; code?: string } | null, fallback: string) {
  if (!error) return new Error(fallback);
  const status = /not found/i.test(error.message || "") ? 404 : /forbidden|does not target/i.test(error.message || "") ? 403 : /duplicate|already active/i.test(error.message || "") ? 409 : 400;
  return Object.assign(new Error(error.message || fallback), {
    status,
    code: error.code || "APPEAL_RPC_ERROR",
  });
}

export async function listUserAppeals(userId: string, status = "", limit = 50) {
  let query = supabaseAdmin
    .from("appeals")
    .select("id,user_id,moderation_case_id,moderation_action_id,resolution_action_id,status,reason_code,requested_outcome,decision,admin_response,last_user_message_at,last_admin_message_at,review_started_at,resolved_at,closed_at,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (status) query = query.eq("status", status);
  const result = await query;
  if (result.error) throw result.error;
  return result.data ?? [];
}

export async function getUserAppeal(userId: string, appealId: string) {
  const appeal = await supabaseAdmin
    .from("appeals")
    .select("id,user_id,moderation_case_id,moderation_action_id,resolution_action_id,status,message,reason_code,requested_outcome,decision,admin_response,last_user_message_at,last_admin_message_at,review_started_at,resolved_at,closed_at,created_at,updated_at")
    .eq("id", appealId)
    .eq("user_id", userId)
    .maybeSingle();
  if (appeal.error) throw appeal.error;
  if (!appeal.data) throw Object.assign(new Error("找不到申訴紀錄。"), { status: 404 });

  const [messages, events, moderationCase, originalAction, resolutionAction] = await Promise.all([
    supabaseAdmin.from("appeal_messages").select("id,appeal_id,sender_role,body,created_at").eq("appeal_id", appealId).order("created_at", { ascending: true }),
    supabaseAdmin.from("appeal_events").select("id,appeal_id,actor_role,event_type,from_status,to_status,created_at").eq("appeal_id", appealId).order("created_at", { ascending: false }).limit(120),
    appeal.data.moderation_case_id
      ? supabaseAdmin.from("moderation_cases").select("id,status,severity,summary,created_at,updated_at,closed_at").eq("id", appeal.data.moderation_case_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    appeal.data.moderation_action_id
      ? supabaseAdmin.from("moderation_actions").select("id,action_type,reason,starts_at,expires_at,created_at").eq("id", appeal.data.moderation_action_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    appeal.data.resolution_action_id
      ? supabaseAdmin.from("moderation_actions").select("id,action_type,reason,starts_at,expires_at,created_at").eq("id", appeal.data.resolution_action_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  for (const result of [messages, events, moderationCase, originalAction, resolutionAction]) {
    if (result.error) throw result.error;
  }

  return {
    appeal: appeal.data,
    messages: messages.data ?? [],
    events: events.data ?? [],
    moderation_case: moderationCase.data ?? null,
    original_action: originalAction.data ?? null,
    resolution_action: resolutionAction.data ?? null,
  };
}

export async function createAppeal(input: CreateAppealInput) {
  const reasonCode = cleanText(input.reasonCode || "other", 40) || "other";
  assertAppealReasonCode(reasonCode);
  const message = cleanText(input.message, 6000);
  if (message.length < 10) {
    throw Object.assign(new Error("申訴內容至少需要 10 個字。"), { status: 400 });
  }
  if (!input.moderationCaseId && !input.moderationActionId) {
    throw Object.assign(new Error("申訴必須關聯治理案件或治理處置。"), { status: 400 });
  }

  const result = await supabaseAdmin.rpc("cowork_create_appeal", {
    p_user_id: input.userId,
    p_moderation_case_id: input.moderationCaseId || null,
    p_moderation_action_id: input.moderationActionId || null,
    p_reason_code: reasonCode,
    p_message: message,
    p_requested_outcome: cleanText(input.requestedOutcome, 1000) || null,
    p_idempotency_key: cleanText(input.idempotencyKey, 120) || null,
    p_metadata: input.metadata ?? {},
  });
  if (result.error) throw rpcError(result.error, "建立申訴失敗。");
  return result.data as { appeal: Record<string, unknown>; created: boolean };
}

export async function appendAppealMessage(input: {
  appealId: string;
  actorUserId: string;
  actorRole: "user" | "admin";
  body: string;
  metadata?: Record<string, unknown>;
}) {
  const body = cleanText(input.body, 6000);
  if (!body) throw Object.assign(new Error("訊息不能空白。"), { status: 400 });
  const result = await supabaseAdmin.rpc("cowork_append_appeal_message", {
    p_appeal_id: input.appealId,
    p_actor_user_id: input.actorUserId,
    p_actor_role: input.actorRole,
    p_body: body,
    p_metadata: input.metadata ?? {},
  });
  if (result.error) throw rpcError(result.error, "新增申訴訊息失敗。");
  return result.data;
}

export async function closeUserAppeal(appealId: string, userId: string) {
  const result = await supabaseAdmin.rpc("cowork_close_appeal", {
    p_appeal_id: appealId,
    p_user_id: userId,
  });
  if (result.error) throw rpcError(result.error, "關閉申訴失敗。");
  return result.data;
}

export async function listAdminAppeals(status = "", limit = 100) {
  let query = supabaseAdmin
    .from("appeals")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));
  if (status) query = query.eq("status", status);
  const result = await query;
  if (result.error) throw result.error;
  return result.data ?? [];
}

export async function getAdminAppeal(appealId: string) {
  const appeal = await supabaseAdmin.from("appeals").select("*").eq("id", appealId).maybeSingle();
  if (appeal.error) throw appeal.error;
  if (!appeal.data) throw Object.assign(new Error("找不到申訴。"), { status: 404 });
  const [messages, events, moderationCase, actions] = await Promise.all([
    supabaseAdmin.from("appeal_messages").select("*").eq("appeal_id", appealId).order("created_at", { ascending: true }),
    supabaseAdmin.from("appeal_events").select("*").eq("appeal_id", appealId).order("created_at", { ascending: false }).limit(160),
    appeal.data.moderation_case_id
      ? supabaseAdmin.from("moderation_cases").select("*").eq("id", appeal.data.moderation_case_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    appeal.data.moderation_case_id
      ? supabaseAdmin.from("moderation_actions").select("*").eq("case_id", appeal.data.moderation_case_id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [messages, events, moderationCase, actions]) {
    if (result.error) throw result.error;
  }
  return {
    appeal: appeal.data,
    messages: messages.data ?? [],
    events: events.data ?? [],
    moderation_case: moderationCase.data ?? null,
    moderation_actions: actions.data ?? [],
  };
}

export async function decideAppeal(input: AppealDecisionInput) {
  const current = await supabaseAdmin.from("appeals").select("status").eq("id", input.appealId).maybeSingle();
  if (current.error) throw current.error;
  if (!current.data) throw Object.assign(new Error("找不到申訴。"), { status: 404 });
  assertAppealTransition(current.data.status, input.status);
  if (["accepted", "rejected"].includes(input.status) && !cleanText(input.adminResponse, 6000)) {
    throw Object.assign(new Error("接受或駁回申訴時必須填寫使用者可見的回覆。"), { status: 400 });
  }

  const result = await supabaseAdmin.rpc("cowork_transition_appeal", {
    p_appeal_id: input.appealId,
    p_admin_user_id: input.adminUserId,
    p_to_status: input.status,
    p_admin_response: cleanText(input.adminResponse, 6000) || null,
    p_decision_reason: cleanText(input.decisionReason, 3000) || null,
    p_create_restore_action: Boolean(input.createRestoreAction),
    p_metadata: input.metadata ?? {},
  });
  if (result.error) throw rpcError(result.error, "更新申訴失敗。");
  return result.data;
}

export function publicAppealReasonOptions() {
  return [...APPEAL_REASON_CODES];
}
