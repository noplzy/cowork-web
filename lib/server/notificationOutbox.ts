import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const NOTIFICATION_OUTBOX_BUILD_TAG = "notification-outbox-v111-2026-06-04";

function envFlag(name: string) {
  return ["1", "true", "yes", "enabled"].includes(String(process.env[name] || "").trim().toLowerCase());
}

export function verifyNotificationProcessorSecret(req: Request) {
  const expected = process.env.NOTIFICATION_PROCESSOR_SECRET || process.env.BILLING_AUTOMATION_SECRET || process.env.CRON_SECRET || process.env.ROOM_CLEANUP_SECRET;
  if (!expected) throw new Error("Missing NOTIFICATION_PROCESSOR_SECRET / BILLING_AUTOMATION_SECRET / CRON_SECRET / ROOM_CLEANUP_SECRET");

  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";
  const got = req.headers.get("x-cron-secret") || req.headers.get("x-internal-secret") || new URL(req.url).searchParams.get("secret") || bearer;
  if (got !== expected) throw Object.assign(new Error("UNAUTHORIZED_NOTIFICATION_PROCESSOR"), { status: 401 });
}

export async function queueNotification(input: {
  userId?: string | null;
  channel?: "in_app" | "email" | "sms" | "line" | "telegram" | "webhook";
  recipient?: string | null;
  templateKey: string;
  subject?: string | null;
  body: string;
  priority?: "low" | "normal" | "high" | "urgent";
  targetType?: string | null;
  targetId?: string | null;
  dedupeKey?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const payload = {
    user_id: input.userId ?? null,
    channel: input.channel ?? "in_app",
    recipient: input.recipient ?? null,
    template_key: input.templateKey,
    subject: input.subject ?? null,
    body: input.body,
    priority: input.priority ?? "normal",
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    dedupe_key: input.dedupeKey ?? null,
    metadata: input.metadata ?? {},
  };

  const query = supabaseAdmin.from("notification_outbox").insert(payload).select("*").single();
  const result = await query;

  if (result.error && /duplicate key value/.test(result.error.message) && input.dedupeKey) {
    const existing = await supabaseAdmin.from("notification_outbox").select("*").eq("dedupe_key", input.dedupeKey).maybeSingle();
    if (existing.error) throw existing.error;
    return existing.data;
  }

  if (result.error) throw result.error;
  return result.data;
}

async function postJson(endpoint: string, payload: Record<string, unknown>) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`provider_http_${response.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

function endpointForChannel(channel: string) {
  if (channel === "email") return process.env.NOTIFICATION_EMAIL_ENDPOINT || "";
  if (channel === "sms") return process.env.NOTIFICATION_SMS_ENDPOINT || "";
  if (channel === "line") return process.env.NOTIFICATION_LINE_ENDPOINT || "";
  if (channel === "telegram") return process.env.NOTIFICATION_TELEGRAM_ENDPOINT || "";
  if (channel === "webhook") return process.env.NOTIFICATION_WEBHOOK_ENDPOINT || "";
  return "";
}

export async function processNotificationOutbox(limit = 40) {
  const liveEnabled = envFlag("NOTIFICATION_PROVIDER_ENABLED");
  const pending = await supabaseAdmin
    .from("notification_outbox")
    .select("*")
    .in("status", ["queued", "failed"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (pending.error) throw pending.error;
  const results: any[] = [];

  for (const item of pending.data ?? []) {
    if (item.channel === "in_app") {
      await supabaseAdmin
        .from("notification_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", item.id);
      results.push({ id: item.id, status: "sent", channel: "in_app" });
      continue;
    }

    const endpoint = endpointForChannel(item.channel);
    if (!liveEnabled || !endpoint) {
      await supabaseAdmin
        .from("notification_outbox")
        .update({ status: "manual_required", updated_at: new Date().toISOString() })
        .eq("id", item.id);
      results.push({ id: item.id, status: "manual_required", channel: item.channel });
      continue;
    }

    await supabaseAdmin
      .from("notification_outbox")
      .update({ status: "processing", attempt_count: Number(item.attempt_count || 0) + 1, updated_at: new Date().toISOString() })
      .eq("id", item.id);

    try {
      const providerResult = await postJson(endpoint, { notification: item });
      await supabaseAdmin
        .from("notification_outbox")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider: providerResult.provider ?? item.channel,
          provider_message_id: providerResult.message_id ?? providerResult.id ?? null,
          provider_payload: providerResult,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      results.push({ id: item.id, status: "sent", channel: item.channel });
    } catch (error: any) {
      await supabaseAdmin
        .from("notification_outbox")
        .update({
          status: "failed",
          last_error: error?.message || "provider_error",
          next_attempt_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      results.push({ id: item.id, status: "failed", error: error?.message || "provider_error" });
    }
  }

  return results;
}
