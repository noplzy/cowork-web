import {
  SendAuthSmsInput,
  SendAuthSmsResult,
  SmsProviderAdapter,
  SmsProviderError,
  SmsProviderName,
} from "@/lib/sms/provider-types";
import { birdSmsProvider } from "@/lib/sms/providers/bird";
import { textlocalSmsProvider } from "@/lib/sms/providers/textlocal";
import { vonageSmsProvider } from "@/lib/sms/providers/vonage";

type ProviderChainConfig = {
  primary: SmsProviderName | null;
  fallback: SmsProviderName | null;
  allowNoop: boolean;
  timeoutMs: number;
};

const providerMap: Record<SmsProviderName, SmsProviderAdapter> = {
  vonage: vonageSmsProvider,
  bird: birdSmsProvider,
  textlocal: textlocalSmsProvider,
};

function parseProviderName(value: string | undefined): SmsProviderName | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "vonage" || normalized === "bird" || normalized === "textlocal") {
    return normalized;
  }
  return null;
}

function getProviderChainConfig(): ProviderChainConfig {
  return {
    primary: parseProviderName(process.env.AUTH_SMS_PRIMARY_PROVIDER) ?? "vonage",
    fallback: parseProviderName(process.env.AUTH_SMS_FALLBACK_PROVIDER),
    allowNoop: process.env.AUTH_SMS_ALLOW_NOOP === "true",
    timeoutMs: Number(process.env.AUTH_SMS_PROVIDER_TIMEOUT_MS ?? 10_000),
  };
}

function dedupeProviders(
  primary: SmsProviderName | null,
  fallback: SmsProviderName | null
): SmsProviderName[] {
  const ordered: SmsProviderName[] = [];
  if (primary) ordered.push(primary);
  if (fallback && fallback !== primary) ordered.push(fallback);
  return ordered;
}

function toProviderError(provider: SmsProviderName | null, error: unknown): SmsProviderError {
  if (error instanceof SmsProviderError) return error;
  if (error instanceof Error) {
    return new SmsProviderError({
      provider,
      code: "SMS_PROVIDER_ERROR",
      message: error.message,
      retryable: true,
      details: { stack: error.stack },
    });
  }

  return new SmsProviderError({
    provider,
    code: "SMS_PROVIDER_ERROR",
    message: "Unknown SMS provider error",
    retryable: true,
    details: error,
  });
}

export async function sendAuthSmsThroughProviderChain(
  input: SendAuthSmsInput
): Promise<SendAuthSmsResult> {
  const config = getProviderChainConfig();
  const ordered = dedupeProviders(config.primary, config.fallback);

  if (ordered.length === 0) {
    if (config.allowNoop) {
      return {
        provider: "noop",
        providerMessageId: null,
        raw: {
          reason: "No SMS provider configured",
        },
      };
    }

    throw new SmsProviderError({
      provider: null,
      code: "NO_SMS_PROVIDER_CONFIGURED",
      message:
        "No SMS provider is configured. Set AUTH_SMS_PRIMARY_PROVIDER and the corresponding provider credentials.",
      retryable: false,
    });
  }

  let lastError: SmsProviderError | null = null;

  for (const providerName of ordered) {
    const provider = providerMap[providerName];

    try {
      return await provider.send(input, config.timeoutMs);
    } catch (error) {
      lastError = toProviderError(providerName, error);
    }
  }

  if (config.allowNoop) {
    return {
      provider: "noop",
      providerMessageId: null,
      raw: {
        reason: "Provider chain failed but AUTH_SMS_ALLOW_NOOP=true",
        lastError: lastError
          ? {
              provider: lastError.provider,
              code: lastError.code,
              message: lastError.message,
            }
          : null,
      },
    };
  }

  throw (
    lastError ??
    new SmsProviderError({
      provider: null,
      code: "SMS_PROVIDER_CHAIN_FAILED",
      message: "All configured SMS providers failed.",
      retryable: true,
    })
  );
}
