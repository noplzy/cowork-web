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
  let inputForAudit:
    | ReturnType<typeof buildSmsInput>
    | null = null;

  try {
    verifySupabaseHookSignature(req.bodyUsed ? rawBody : rawBody, req.headers);
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
