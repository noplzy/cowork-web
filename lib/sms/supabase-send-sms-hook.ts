import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { renderAuthSmsMessage } from "@/lib/sms/message-template";
import { sendAuthSmsThroughProviderChain } from "@/lib/sms/provider-chain";
import {
  SendAuthSmsInput,
  SendAuthSmsResult,
  SmsFlow,
  SmsProviderError,
} from "@/lib/sms/provider-types";

export type SupabaseSendSmsHookEvent = {
  user?: {
    id?: string;
    phone?: string;
    confirmation_sent_at?: string | null;
    phone_change_sent_at?: string | null;
    phone_confirmed_at?: string | null;
    app_metadata?: {
      provider?: string;
      providers?: string[];
    };
  };
  sms?: {
    otp?: string;
  };
};

type AuthSmsAuditStatus = "sent" | "failed" | "skipped";

function getHookSecretsFromEnv(): string[] {
  const raw = process.env.SUPABASE_AUTH_HOOK_SEND_SMS_SECRET?.trim() || "";
  if (!raw) return [];

  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => part !== "v1")
    .map((part) => (part.startsWith("whsec_") ? part.slice("whsec_".length) : part));
}

function extractSignatures(signatureHeader: string): string[] {
  return signatureHeader
    .split(" ")
    .flatMap((chunk) => chunk.split(","))
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith("v1,")) return part.slice(3);
      if (part.startsWith("v1=")) return part.slice(3);
      return part;
    })
    .filter(Boolean);
}

function constantTimeBase64Equal(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifySupabaseHookSignature(rawBody: string, headers: Headers): void {
  const skipCheck = process.env.SUPABASE_AUTH_HOOK_SKIP_SIGNATURE_CHECK === "true";
  const secrets = getHookSecretsFromEnv();

  if (!secrets.length) {
    if (skipCheck) return;

    throw new SmsProviderError({
      provider: null,
      code: "HOOK_SECRET_NOT_CONFIGURED",
      message: "SUPABASE_AUTH_HOOK_SEND_SMS_SECRET is not configured.",
      retryable: false,
    });
  }

  const webhookId = headers.get("webhook-id")?.trim() || "";
  const webhookTimestamp = headers.get("webhook-timestamp")?.trim() || "";
  const webhookSignature = headers.get("webhook-signature")?.trim() || "";

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    throw new SmsProviderError({
      provider: null,
      code: "INVALID_HOOK_SIGNATURE_HEADERS",
      message: "Missing webhook signature headers.",
      retryable: false,
    });
  }

  const maxAgeSeconds = Number(process.env.SUPABASE_AUTH_HOOK_MAX_AGE_SECONDS ?? 300);
  const timestampSeconds = Number(webhookTimestamp);

  if (!Number.isFinite(timestampSeconds)) {
    throw new SmsProviderError({
      provider: null,
      code: "INVALID_HOOK_TIMESTAMP",
      message: "Invalid webhook timestamp.",
      retryable: false,
    });
  }

  if (Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) > maxAgeSeconds) {
    throw new SmsProviderError({
      provider: null,
      code: "HOOK_TIMESTAMP_EXPIRED",
      message: "Webhook timestamp is outside the accepted window.",
      retryable: false,
    });
  }

  const signatures = extractSignatures(webhookSignature);
  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;

  const matched = secrets.some((secret) => {
    let key: Buffer;

    try {
      key = Buffer.from(secret, "base64");
      if (!key.length) {
        key = Buffer.from(secret, "utf8");
      }
    } catch {
      key = Buffer.from(secret, "utf8");
    }

    const expected = createHmac("sha256", key).update(signedContent).digest("base64");
    return signatures.some((candidate) => constantTimeBase64Equal(candidate, expected));
  });

  if (!matched) {
    throw new SmsProviderError({
      provider: null,
      code: "HOOK_SIGNATURE_MISMATCH",
      message: "Webhook signature verification failed.",
      retryable: false,
    });
  }
}

export function parseSupabaseSendSmsHookEvent(rawBody: string): SupabaseSendSmsHookEvent {
  const parsed = JSON.parse(rawBody) as SupabaseSendSmsHookEvent;
  const phone = parsed.user?.phone?.trim();
  const otp = parsed.sms?.otp?.trim();

  if (!phone || !otp) {
    throw new SmsProviderError({
      provider: null,
      code: "INVALID_HOOK_PAYLOAD",
      message: "Supabase send SMS hook payload is missing user.phone or sms.otp.",
      retryable: false,
      details: parsed,
    });
  }

  return parsed;
}

export function inferSmsFlow(event: SupabaseSendSmsHookEvent): SmsFlow {
  if (event.user?.phone_change_sent_at) return "phone_change";

  const provider = event.user?.app_metadata?.provider ?? "";
  const providers = event.user?.app_metadata?.providers ?? [];

  if (provider === "phone" || providers.includes("phone")) {
    if (event.user?.phone_confirmed_at) return "mfa";
    return "phone_signup";
  }

  if (event.user?.confirmation_sent_at) return "phone_signin";
  return "unknown";
}

export function buildSmsInput(event: SupabaseSendSmsHookEvent): SendAuthSmsInput {
  const phone = event.user?.phone?.trim() || "";
  const otp = event.sms?.otp?.trim() || "";
  const flow = inferSmsFlow(event);

  return {
    to: phone,
    otp,
    flow,
    userId: event.user?.id ?? null,
    message: renderAuthSmsMessage({
      otp,
      to: phone,
      flow,
    }),
    metadata: {
      confirmation_sent_at: event.user?.confirmation_sent_at ?? null,
      phone_change_sent_at: event.user?.phone_change_sent_at ?? null,
      phone_confirmed_at: event.user?.phone_confirmed_at ?? null,
    },
  };
}

export async function logAuthSmsAttempt(params: {
  input: SendAuthSmsInput;
  result?: SendAuthSmsResult;
  error?: SmsProviderError | null;
  status: AuthSmsAuditStatus;
}): Promise<void> {
  try {
    await supabaseAdmin.from("auth_sms_attempts").insert({
      user_id: params.input.userId,
      phone: params.input.to,
      otp_flow: params.input.flow,
      provider: params.result?.provider ?? params.error?.provider ?? "unknown",
      status: params.status,
      provider_message_id: params.result?.providerMessageId ?? null,
      error_code: params.error?.code ?? null,
      error_message: params.error?.message ?? null,
      metadata: {
        message_preview: params.input.message,
        provider_raw: params.result?.raw ?? null,
        provider_error_details: params.error?.details ?? null,
        input_metadata: params.input.metadata ?? null,
      },
    });
  } catch {
    // Intentionally swallow logging failures so auth is not blocked by an observability-only table.
  }
}
