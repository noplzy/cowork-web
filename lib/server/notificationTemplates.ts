import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { queueNotification } from "@/lib/server/notificationOutbox";

export const NOTIFICATION_TEMPLATES_BUILD_TAG = "notification-templates-v1121-2026-06-05";

export type NotificationChannel = "in_app" | "email" | "sms" | "line" | "telegram" | "webhook";
export type NotificationCategory = "support" | "billing" | "safety" | "room" | "ai" | "system" | "marketing";
export type NotificationPriority = "low" | "normal" | "high" | "urgent";

type TemplateVariables = Record<string, string | number | boolean | null | undefined>;

const DEFAULT_PREFERENCES = {
  in_app_enabled: true,
  email_enabled: true,
  sms_enabled: false,
  line_enabled: false,
  telegram_enabled: false,
  support_updates: true,
  billing_updates: true,
  safety_updates: true,
  room_updates: true,
  marketing_updates: false,
  quiet_hours_enabled: false,
  quiet_hours_start: null,
  quiet_hours_end: null,
  locale: "zh-TW",
};

const VALID_CHANNELS: readonly NotificationChannel[] = ["in_app", "email", "sms", "line", "telegram", "webhook"];

function normalizeChannels(channels?: NotificationChannel[] | null): NotificationChannel[] {
  if (!channels?.length) return ["in_app"];
  return channels.filter((channel): channel is NotificationChannel =>
    VALID_CHANNELS.includes(channel as NotificationChannel),
  );
}

function renderTemplate(template: string | null | undefined, variables: TemplateVariables) {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = variables[key];
    if (value === null || value === undefined) return "";
    return String(value);
  });
}

function preferenceKeyForChannel(channel: NotificationChannel) {
  if (channel === "email") return "email_enabled";
  if (channel === "sms") return "sms_enabled";
  if (channel === "line") return "line_enabled";
  if (channel === "telegram") return "telegram_enabled";
  return "in_app_enabled";
}

function preferenceKeyForCategory(category: string) {
  if (category === "support") return "support_updates";
  if (category === "billing") return "billing_updates";
  if (category === "safety") return "safety_updates";
  if (category === "room") return "room_updates";
  if (category === "marketing") return "marketing_updates";
  return null;
}

export async function ensureNotificationPreferences(userId: string) {
  const existing = await supabaseAdmin
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const inserted = await supabaseAdmin
    .from("notification_preferences")
    .insert({ user_id: userId, ...DEFAULT_PREFERENCES })
    .select("*")
    .single();

  if (inserted.error) throw inserted.error;
  return inserted.data;
}

export async function getNotificationPreferences(userId: string) {
  return ensureNotificationPreferences(userId);
}

export async function updateNotificationPreferences(userId: string, patch: Record<string, unknown>) {
  await ensureNotificationPreferences(userId);

  const allowedBooleanKeys = [
    "in_app_enabled",
    "email_enabled",
    "sms_enabled",
    "line_enabled",
    "telegram_enabled",
    "support_updates",
    "billing_updates",
    "safety_updates",
    "room_updates",
    "marketing_updates",
    "quiet_hours_enabled",
  ];

  const update: Record<string, unknown> = {};

  for (const key of allowedBooleanKeys) {
    if (typeof patch[key] === "boolean") update[key] = patch[key];
  }

  if (typeof patch.quiet_hours_start === "string") update.quiet_hours_start = patch.quiet_hours_start.slice(0, 8);
  if (typeof patch.quiet_hours_end === "string") update.quiet_hours_end = patch.quiet_hours_end.slice(0, 8);
  if (typeof patch.locale === "string") update.locale = patch.locale.slice(0, 12);
  update.updated_at = new Date().toISOString();

  const result = await supabaseAdmin
    .from("notification_preferences")
    .update(update)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (result.error) throw result.error;
  return result.data;
}

export async function listNotificationTemplates() {
  const result = await supabaseAdmin
    .from("notification_templates")
    .select("*")
    .order("category", { ascending: true })
    .order("template_key", { ascending: true });

  if (result.error) throw result.error;
  return result.data ?? [];
}

export async function queueTemplateNotification(input: {
  userId: string;
  templateKey: string;
  variables?: TemplateVariables;
  channels?: NotificationChannel[];
  priority?: NotificationPriority;
  targetType?: string | null;
  targetId?: string | null;
  dedupeKey?: string | null;
  force?: boolean;
  recipient?: string | null;
}) {
  const preferences = await ensureNotificationPreferences(input.userId);
  const channels: NotificationChannel[] = normalizeChannels(input.channels);
  const results: Array<Record<string, unknown>> = [];

  for (const channel of channels) {
    const template = await supabaseAdmin
      .from("notification_templates")
      .select("*")
      .eq("template_key", input.templateKey)
      .eq("channel", channel)
      .eq("enabled", true)
      .maybeSingle();

    if (template.error) throw template.error;

    let fallbackTemplate = template.data;

    if (!fallbackTemplate && channel !== "in_app") {
      const fallback = await supabaseAdmin
        .from("notification_templates")
        .select("*")
        .eq("template_key", input.templateKey)
        .eq("channel", "in_app")
        .eq("enabled", true)
        .maybeSingle();

      if (fallback.error) throw fallback.error;
      fallbackTemplate = fallback.data;
    }

    if (!fallbackTemplate) {
      results.push({ channel, skipped: true, reason: "template_not_found" });
      continue;
    }

    const channelPreferenceKey = preferenceKeyForChannel(channel);
    const categoryPreferenceKey = preferenceKeyForCategory(String(fallbackTemplate.category || "system"));
    const channelAllowed = Boolean(preferences[channelPreferenceKey]);
    const categoryAllowed = categoryPreferenceKey ? Boolean(preferences[categoryPreferenceKey]) : true;

    if (!input.force && (!channelAllowed || !categoryAllowed)) {
      results.push({ channel, skipped: true, reason: "preference_disabled" });
      continue;
    }

    const queued = await queueNotification({
      userId: input.userId,
      channel,
      recipient: input.recipient ?? null,
      templateKey: input.templateKey,
      subject: renderTemplate(fallbackTemplate.subject_template, input.variables ?? {}),
      body: renderTemplate(fallbackTemplate.body_template, input.variables ?? {}),
      priority: input.priority ?? "normal",
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      dedupeKey: input.dedupeKey ? `${input.dedupeKey}:${channel}` : null,
      metadata: {
        source: "notification_template_v1121",
        variables: input.variables ?? {},
        category: fallbackTemplate.category,
      },
    });

    results.push({ channel, notification: queued });
  }

  return results;
}
