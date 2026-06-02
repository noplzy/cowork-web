export const SUPPORT_CHANNELS_BUILD_TAG = "support-channels-google-form-bridge-2026-06-02";

export const PUBLIC_SUPPORT_GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSePIg1i9YDIxPWeWnaxTjJ2a-NTrAGp1qhwINFN63KZYtMkYw/viewform";

export type SupportChannelKind = "google_form" | "first_party_ticket" | "email";

export type SupportChannel = {
  kind: SupportChannelKind;
  label: string;
  description: string;
  href?: string;
  api_path?: string;
  requires_login: boolean;
  recommended_for: string[];
};

export const SUPPORT_CHANNELS: SupportChannel[] = [
  {
    kind: "google_form",
    label: "Google 表單客服入口",
    description:
      "正式客服後台完成前，保留既有 Google 表單作為公開、低摩擦、未登入也可使用的客服入口。",
    href: PUBLIC_SUPPORT_GOOGLE_FORM_URL,
    requires_login: false,
    recommended_for: ["未登入訪客", "一般詢問", "早期試營運回報", "無法登入帳號時"],
  },
  {
    kind: "first_party_ticket",
    label: "站內客服單",
    description:
      "登入後的正式客服資料流；適合付款、退款、房間、檢舉、Buddies、帳號與可稽核事件。",
    api_path: "/api/support/tickets",
    requires_login: true,
    recommended_for: ["付款問題", "退款申請", "房間問題", "安全檢舉", "Buddies 預約", "帳號問題"],
  },
];

export function shouldUseFirstPartyTicket(category?: string | null) {
  const value = String(category || "").trim();
  return ["payment", "invoice", "room", "safety", "buddies", "ai", "refund", "account"].includes(value);
}
