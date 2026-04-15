export type SmsProviderName = "vonage" | "bird" | "textlocal";

export type SmsFlow =
  | "phone_change"
  | "phone_signup"
  | "phone_signin"
  | "mfa"
  | "unknown";

export type SendAuthSmsInput = {
  to: string;
  message: string;
  otp: string;
  flow: SmsFlow;
  userId: string | null;
  metadata?: Record<string, unknown>;
};

export type SendAuthSmsSuccess = {
  provider: SmsProviderName;
  providerMessageId: string | null;
  raw: unknown;
};

export type SendAuthSmsSkipped = {
  provider: "noop";
  providerMessageId: null;
  raw: unknown;
};

export type SendAuthSmsResult = SendAuthSmsSuccess | SendAuthSmsSkipped;

export class SmsProviderError extends Error {
  readonly provider: SmsProviderName | null;
  readonly code: string;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(params: {
    provider: SmsProviderName | null;
    code: string;
    message: string;
    retryable?: boolean;
    details?: unknown;
  }) {
    super(params.message);
    this.name = "SmsProviderError";
    this.provider = params.provider;
    this.code = params.code;
    this.retryable = params.retryable ?? true;
    this.details = params.details;
  }
}

export interface SmsProviderAdapter {
  readonly name: SmsProviderName;
  send(input: SendAuthSmsInput, timeoutMs: number): Promise<SendAuthSmsSuccess>;
}
