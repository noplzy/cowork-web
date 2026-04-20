import { NextResponse } from "next/server";
import {
  buildSmsInput,
  logAuthSmsAttempt,
  parseSupabaseSendSmsHookEvent,
  verifySupabaseHookSignature,
} from "@/lib/sms/supabase-send-sms-hook";
import { sendAuthSmsThroughProviderChain } from "@/lib/sms/provider-chain";
import { SmsProviderError } from "@/lib/sms/provider-types";

export const runtime = "nodejs";

function maskPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  if (v.length <= 4) return "*".repeat(v.length);
  return `${v.slice(0, 4)}***${v.slice(-3)}`;
}

function sanitizeJsonForLogs(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonForLogs(item));
  }

  if (!value || typeof value !== "object") {
    if (typeof value === "string") {
      return value.length > 180 ? `${value.slice(0, 180)}...` : value;
    }
    return value;
  }

  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const [key, raw] of Object.entries(source)) {
    const lowered = key.toLowerCase();

    if (
      lowered.includes("otp") ||
      lowered.includes("token") ||
      lowered.includes("secret") ||
      lowered.includes("password") ||
      lowered.includes("code")
    ) {
      out[key] = "[redacted]";
      continue;
    }

    if (lowered.includes("phone")) {
      out[key] = maskPhone(raw);
      continue;
    }

    out[key] = sanitizeJsonForLogs(raw);
  }

  return out;
}

function buildPayloadDiagnostic(rawBody: string) {
  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    const user =
      parsed?.user && typeof parsed.user === "object"
        ? (parsed.user as Record<string, unknown>)
        : null;
    const sms =
      parsed?.sms && typeof parsed.sms === "object"
        ? (parsed.sms as Record<string, unknown>)
        : null;

    return {
      rawBodyLength: rawBody.length,
      topLevelKeys: Object.keys(parsed || {}),
      hasUser: Boolean(user),
      hasSms: Boolean(sms),
      userKeys: user ? Object.keys(user) : [],
      smsKeys: sms ? Object.keys(sms) : [],
      maskedPayload: sanitizeJsonForLogs(parsed),
    };
  } catch {
    return {
      rawBodyLength: rawBody.length,
      parseableJson: false,
      rawBodyPreview: rawBody.slice(0, 300),
    };
  }
}

function toErrorResponse(error: SmsProviderError) {
  const status =
    error.code === "HOOK_SECRET_NOT_CONFIGURED" ||
    error.code === "INVALID_HOOK_SIGNATURE_HEADERS" ||
    error.code === "INVALID_HOOK_TIMESTAMP" ||
    error.code === "HOOK_TIMESTAMP_EXPIRED" ||
    error.code === "HOOK_SIGNATURE_MISMATCH"
      ? 401
      : error.code === "INVALID_HOOK_PAYLOAD"
      ? 400
      : 502;

  return NextResponse.json(
    {
      error: {
        http_code: status,
        message: error.message,
      },
    },
    { status }
  );
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  let inputForAudit: ReturnType<typeof buildSmsInput> | null = null;

  try {
    verifySupabaseHookSignature(rawBody, req.headers);

    const event = parseSupabaseSendSmsHookEvent(rawBody);
    const input = buildSmsInput(event);
    inputForAudit = input;

    const result = await sendAuthSmsThroughProviderChain(input);
    await logAuthSmsAttempt({
      input,
      result,
      status: result.provider === "noop" ? "skipped" : "sent",
    });

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    const providerError =
      error instanceof SmsProviderError
        ? error
        : new SmsProviderError({
            provider: null,
            code: "SEND_SMS_HOOK_UNEXPECTED_ERROR",
            message:
              error instanceof Error
                ? error.message
                : "Unexpected error while processing the Supabase Send SMS hook.",
            details: error,
          });

    if (providerError.code === "INVALID_HOOK_PAYLOAD") {
      console.error("[sms-hook] invalid payload diagnostic", {
        diagnostic: buildPayloadDiagnostic(rawBody),
        errorCode: providerError.code,
        errorMessage: providerError.message,
        errorDetails: sanitizeJsonForLogs(providerError.details),
      });
    } else {
      console.error("[sms-hook] request failed", {
        errorCode: providerError.code,
        errorMessage: providerError.message,
        errorDetails: sanitizeJsonForLogs(providerError.details),
      });
    }

    if (inputForAudit) {
      await logAuthSmsAttempt({
        input: inputForAudit,
        error: providerError,
        status: "failed",
      });
    }

    return toErrorResponse(providerError);
  }
}
