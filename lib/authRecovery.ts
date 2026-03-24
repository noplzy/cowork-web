import { supabase } from "@/lib/supabaseClient";
import { clearAccountStatusCache } from "@/lib/accountStatusClient";

const REFRESH_TOKEN_ERROR_PATTERNS = [
  "invalid refresh token",
  "refresh token not found",
  "jwt expired",
  "invalid_grant",
];

export function isRecoverableAuthSessionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  return REFRESH_TOKEN_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function clearSupabaseBrowserStorage() {
  if (typeof window === "undefined") return;

  const clearFromStore = (store: Storage) => {
    const keysToDelete: string[] = [];
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (!key) continue;
      if (key.startsWith("sb-") || key.startsWith("supabase.auth.token")) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => store.removeItem(key));
  };

  try {
    clearFromStore(window.localStorage);
  } catch {}

  try {
    clearFromStore(window.sessionStorage);
  } catch {}
}

export async function recoverFromBrokenBrowserSession() {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {}

  clearSupabaseBrowserStorage();
  clearAccountStatusCache();
}
