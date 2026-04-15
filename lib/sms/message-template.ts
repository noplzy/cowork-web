import { SendAuthSmsInput } from "@/lib/sms/provider-types";

function getDefaultTemplate(): string {
  return "{{BRAND}} 驗證碼：{{CODE}}。10 分鐘內有效，請勿提供給任何人。";
}

export function renderAuthSmsMessage(input: Pick<SendAuthSmsInput, "otp" | "to" | "flow">): string {
  const template = process.env.AUTH_SMS_MESSAGE_TEMPLATE?.trim() || getDefaultTemplate();
  const brand = process.env.AUTH_SMS_BRAND_NAME?.trim() || "Calm&Co";

  return template
    .replaceAll("{{BRAND}}", brand)
    .replaceAll("{{CODE}}", input.otp)
    .replaceAll("{{PHONE}}", input.to)
    .replaceAll("{{FLOW}}", input.flow);
}
