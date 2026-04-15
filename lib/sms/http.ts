import { SmsProviderError, SmsProviderName } from "@/lib/sms/provider-types";

export async function fetchWithTimeout(
  provider: SmsProviderName,
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new SmsProviderError({
        provider,
        code: "SMS_PROVIDER_TIMEOUT",
        message: `${provider} request timed out after ${timeoutMs}ms.`,
        retryable: true,
      });
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}
