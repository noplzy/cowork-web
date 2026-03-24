import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

export type ClientSessionSnapshot = {
  user: User;
  email: string;
  accessToken: string | null;
};

const SESSION_TTL_MS = 15_000;

let cachedSession: { value: ClientSessionSnapshot | null; expiresAt: number } | null = null;
let inflightSession: Promise<ClientSessionSnapshot | null> | null = null;

async function readSessionFromSupabase(): Promise<ClientSessionSnapshot | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const session = data.session;
  if (!session?.user) return null;

  return {
    user: session.user,
    email: session.user.email ?? "",
    accessToken: session.access_token ?? null,
  };
}

export async function getClientSessionSnapshot(options?: { force?: boolean }) {
  const force = Boolean(options?.force);
  const now = Date.now();

  if (!force && cachedSession && cachedSession.expiresAt > now) {
    return cachedSession.value;
  }

  if (!force && inflightSession) {
    return inflightSession;
  }

  inflightSession = readSessionFromSupabase()
    .then((value) => {
      cachedSession = {
        value,
        expiresAt: Date.now() + SESSION_TTL_MS,
      };
      return value;
    })
    .finally(() => {
      inflightSession = null;
    });

  return inflightSession;
}

export function invalidateClientSessionSnapshotCache() {
  cachedSession = null;
  inflightSession = null;
}
