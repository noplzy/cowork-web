export type AccountStatusResp = {
  plan: string;
  is_vip: boolean;
  vip_until?: string | null;
  free_monthly_allowance: number;
  credits_used: number;
  credits_remaining: number | null;
  month_start: string;
};

const STATUS_TTL_MS = 15_000;

const statusCache = new Map<string, { value: AccountStatusResp; expiresAt: number }>();
const inflightStatus = new Map<string, Promise<AccountStatusResp>>();

export async function fetchAccountStatus(
  accessToken: string,
  options?: { force?: boolean },
): Promise<AccountStatusResp> {
  const force = Boolean(options?.force);
  const now = Date.now();
  const cached = statusCache.get(accessToken);

  if (!force && cached && cached.expiresAt > now) {
    return cached.value;
  }

  const existingPromise = inflightStatus.get(accessToken);
  if (!force && existingPromise) {
    return existingPromise;
  }

  const request = fetch("/api/account/status", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
    .then(async (response) => {
      const payload = (await response.json().catch(() => null)) as AccountStatusResp | { error?: string } | null;
      if (!response.ok) {
        throw new Error((payload as { error?: string } | null)?.error ?? "讀取方案資訊失敗");
      }
      const value = payload as AccountStatusResp;
      statusCache.set(accessToken, {
        value,
        expiresAt: Date.now() + STATUS_TTL_MS,
      });
      return value;
    })
    .finally(() => {
      inflightStatus.delete(accessToken);
    });

  inflightStatus.set(accessToken, request);
  return request;
}

export function clearAccountStatusCache() {
  statusCache.clear();
  inflightStatus.clear();
}
