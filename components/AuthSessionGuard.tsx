"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isRecoverableAuthSessionError, recoverFromBrokenBrowserSession } from "@/lib/authRecovery";
import { clearAccountStatusCache } from "@/lib/accountStatusClient";
import { invalidateClientSessionSnapshotCache } from "@/lib/clientAuth";
import { fetchSecurityStatus } from "@/lib/securityStatusClient";

const BLOCK_PAGE = "/blocked";

function isAuthPath(pathname: string) {
  return pathname.startsWith("/auth/");
}

export function AuthSessionGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const validateSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const accessToken = data.session?.access_token;
        if (!accessToken) return;

        if (pathname !== BLOCK_PAGE && !isAuthPath(pathname)) {
          const security = await fetchSecurityStatus(accessToken).catch(() => null);
          if (!cancelled && security?.blocked) {
            router.replace(BLOCK_PAGE);
            return;
          }
        }
      } catch (error) {
        if (!isRecoverableAuthSessionError(error)) {
          console.error("[AuthSessionGuard] unexpected auth error", error);
          return;
        }

        await recoverFromBrokenBrowserSession();
        if (cancelled) return;

        if (pathname !== BLOCK_PAGE) {
          router.replace("/auth/login?reason=session-expired");
        }
      }
    };

    void validateSession();

    const { data } = supabase.auth.onAuthStateChange(() => {
      invalidateClientSessionSnapshotCache();
      clearAccountStatusCache();
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [pathname, router]);

  return null;
}
