"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { clearAccountStatusCache } from "@/lib/accountStatusClient";
import { invalidateClientSessionSnapshotCache } from "@/lib/clientAuth";
import { isRecoverableAuthSessionError, recoverFromBrokenBrowserSession } from "@/lib/authRecovery";

function AuthCallbackFallback() {
  return (
    <main className="cc-login-shell">
      <section className="cc-card cc-stack-md" style={{ width: "min(560px, 100%)" }}>
        <span className="cc-kicker">Auth Callback</span>
        <h1 className="cc-h2">正在完成登入</h1>
        <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
          正在檢查登入狀態，請稍候…
        </p>
      </section>
    </main>
  );
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [msg, setMsg] = useState("正在完成登入，請稍候…");

  useEffect(() => {
    const next = searchParams.get("next") || "/rooms";
    let finished = false;

    const finishWithSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (data.session) {
          finished = true;
          invalidateClientSessionSnapshotCache();
          clearAccountStatusCache();
          router.replace(next);
        }
      } catch (error) {
        if (isRecoverableAuthSessionError(error)) {
          await recoverFromBrokenBrowserSession();
          finished = true;
          router.replace("/auth/login?reason=session-expired");
          return;
        }

        setMsg(error instanceof Error ? error.message : "登入回調處理失敗");
      }
    };

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !finished) {
        finished = true;
        invalidateClientSessionSnapshotCache();
        clearAccountStatusCache();
        router.replace(next);
      }
    });

    void finishWithSession();

    const timer = window.setTimeout(() => {
      if (!finished) {
        router.replace("/auth/login?reason=session-expired");
      }
    }, 8000);

    return () => {
      data.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, [router, searchParams]);

  return (
    <main className="cc-login-shell">
      <section className="cc-card cc-stack-md" style={{ width: "min(560px, 100%)" }}>
        <span className="cc-kicker">Auth Callback</span>
        <h1 className="cc-h2">正在完成登入</h1>
        <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>{msg}</p>
      </section>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthCallbackFallback />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
