export type SecurityStatus = {
  blocked: boolean;
  user_id?: string | null;
  email?: string | null;
  reason?: string | null;
  created_at?: string | null;
  block_scope?: string | null;
  soft_error?: string | null;
};

export async function fetchSecurityStatus(accessToken: string): Promise<SecurityStatus> {
  const resp = await fetch("/api/account/security-status", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const json = (await resp.json().catch(() => ({}))) as SecurityStatus & { error?: string };
  if (!resp.ok && resp.status !== 500) {
    throw new Error(json.error || "無法取得封鎖狀態。");
  }

  return {
    blocked: Boolean(json.blocked),
    user_id: json.user_id ?? null,
    email: json.email ?? null,
    reason: json.reason ?? null,
    created_at: json.created_at ?? null,
    block_scope: json.block_scope ?? null,
    soft_error: json.soft_error ?? null,
  };
}

export function formatBlockTime(input: string | null | undefined): string {
  if (!input) return "未提供";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Taipei",
  }).format(date);
}
