"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isRecoverableAuthSessionError, recoverFromBrokenBrowserSession } from "@/lib/authRecovery";
import { clearAccountStatusCache } from "@/lib/accountStatusClient";
import { invalidateClientSessionSnapshotCache } from "@/lib/clientAuth";

const PROTECTED_PREFIXES = ["/rooms", "/account"];

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function AuthSessionGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const validateSession = async () => {
      try {
        const { error } = await supabase.auth.getSession();
        if (error) throw error;
      } catch (error) {
        if (!isRecoverableAuthSessionError(error)) {
          console.error("[AuthSessionGuard] unexpected auth error", error);
          return;
        }

        await recoverFromBrokenBrowserSession();
        if (cancelled) return;

        if (isProtectedPath(pathname)) {
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
