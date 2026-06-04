import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const HOST_CREDIT_BUILD_TAG = "host-credit-ai-ledger-v108-2026-06-04";

export function hostCreditsForDuration(durationMinutes: number) {
  if (durationMinutes >= 90) return 4;
  if (durationMinutes >= 75) return 3;
  if (durationMinutes >= 50) return 2;
  return 1;
}

export function activeCapSecondsForDuration(durationMinutes: number) {
  return hostCreditsForDuration(durationMinutes) * 120;
}

export async function getHostCreditSnapshot(userId: string) {
  const account = await supabaseAdmin.from("host_credit_accounts").select("*").eq("user_id", userId).maybeSingle();
  if (account.error && !/relation .*host_credit_accounts.* does not exist/i.test(account.error.message)) throw account.error;

  const events = await supabaseAdmin.from("host_credit_events").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(80);
  if (events.error && !/relation .*host_credit_events.* does not exist/i.test(events.error.message)) throw events.error;

  return {
    account: account.data ?? { user_id: userId, balance_total: 0, balance_reserved: 0, lifetime_granted: 0, lifetime_consumed: 0 },
    events: events.data ?? [],
  };
}

export async function grantHostCredits(input: { userId: string; credits: number; eventType?: "grant" | "manual_adjustment" | "subscription_grant" | "migration" | "refund"; paymentOrderId?: string | null; subscriptionProfileId?: string | null; metadata?: Record<string, unknown> }) {
  const { data, error } = await supabaseAdmin.rpc("calmco_adjust_host_credits", {
    p_user_id: input.userId,
    p_delta: Math.abs(input.credits),
    p_event_type: input.eventType ?? "grant",
    p_room_id: null,
    p_sponsor_pass_id: null,
    p_payment_order_id: input.paymentOrderId ?? null,
    p_subscription_profile_id: input.subscriptionProfileId ?? null,
    p_metadata: input.metadata ?? {},
  });
  if (error) throw error;
  return data;
}

export async function createAiHostSponsorPass(input: { roomId: string; sponsorUserId: string; durationMinutes: number; benefitedUserIds?: string[]; metadata?: Record<string, unknown> }) {
  const { data, error } = await supabaseAdmin.rpc("calmco_create_ai_host_sponsor_pass", {
    p_room_id: input.roomId,
    p_sponsor_user_id: input.sponsorUserId,
    p_duration_minutes: input.durationMinutes,
    p_benefited_user_ids: input.benefitedUserIds ?? [],
    p_metadata: input.metadata ?? {},
  });
  if (error) throw error;
  return data;
}
