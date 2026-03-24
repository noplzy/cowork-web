"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { clearAccountStatusCache } from "@/lib/accountStatusClient";
import { getClientSessionSnapshot, invalidateClientSessionSnapshotCache } from "@/lib/clientAuth";
import { isRecoverableAuthSessionError, recoverFromBrokenBrowserSession } from "@/lib/authRecovery";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const reason = searchParams.get("reason");

    if (reason === "session-expired") {
      setMsg("登入狀態已失效，請重新登入一次。");
    }

    (async () => {
      const session = await getClientSessionSnapshot().catch(() => null);
      if (!cancelled && session) {
        router.replace("/rooms");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  async function signIn() {
    setLoading(true);
    setMsg("");

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      invalidateClientSessionSnapshotCache();
      clearAccountStatusCache();
      router.push("/rooms");
    } catch (error) {
      if (isRecoverableAuthSessionError(error)) {
        await recoverFromBrokenBrowserSession();
        setMsg("先前登入狀態已失效，請重新輸入帳號密碼登入。");
      } else {
        setMsg(error instanceof Error ? error.message : "登入失敗，請稍後再試。");
      }
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    setGoogleLoading(true);
    setMsg("");

    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=/rooms`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });

      if (error) throw error;
    } catch (error) {
      setGoogleLoading(false);
      setMsg(error instanceof Error ? error.message : "Google 登入啟動失敗，請稍後再試。");
    }
  }

  return (
    <main className="cc-login-shell">
      <section className="cc-login-grid">
        <div className="cc-card cc-hero-main cc-stack-lg">
          <span className="cc-kicker">Welcome to 安感島</span>
          <p className="cc-eyebrow">登入｜先進來，再慢慢回到節奏</p>
          <h1 className="cc-h1">登入應該順手，而不是像在闖關。</h1>
          <p className="cc-lead" style={{ marginTop: 0 }}>
            你可以使用 Email / 密碼登入，也可以直接用 Google 帳號快速進入。登入後，會直接帶你前往 Rooms 開始下一段專注時間。
          </p>
          <div className="cc-grid-metrics">
            <div className="cc-metric">
              <span className="cc-metric-label">登入後主線</span>
              <div className="cc-metric-value" style={{ fontSize: "1.1rem" }}>Rooms</div>
            </div>
            <div className="cc-metric">
              <span className="cc-metric-label">Google 快速登入</span>
              <div className="cc-metric-value" style={{ fontSize: "1.1rem" }}>一鍵進入</div>
            </div>
            <div className="cc-metric">
              <span className="cc-metric-label">沒有帳號？</span>
              <div className="cc-metric-value" style={{ fontSize: "1.1rem" }}>可先註冊</div>
            </div>
          </div>
          <div className="cc-action-row">
            <Link href="/auth/signup" className="cc-btn">前往註冊頁</Link>
            <Link href="/pricing" className="cc-btn-link">先看方案與價格 →</Link>
          </div>
        </div>

        <div className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">登入你的帳號</p>
            <h2 className="cc-h2">回到你的專注空間</h2>
          </div>

          <button
            className="cc-btn"
            onClick={signInWithGoogle}
            disabled={googleLoading || loading}
            type="button"
            style={{ width: "100%", minHeight: 48, fontWeight: 600 }}
          >
            {googleLoading ? "正在前往 Google…" : "使用 Google 登入"}
          </button>

          <div className="cc-row" style={{ gap: 12, alignItems: "center" }}>
            <div className="cc-soft-divider" style={{ margin: 0 }} />
            <span className="cc-caption" style={{ whiteSpace: "nowrap" }}>或使用 Email 登入</span>
            <div className="cc-soft-divider" style={{ margin: 0 }} />
          </div>

          <label className="cc-field">
            <span className="cc-field-label">Email</span>
            <input
              className="cc-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          <label className="cc-field">
            <span className="cc-field-label">Password</span>
            <input
              className="cc-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="請輸入密碼"
              autoComplete="current-password"
            />
          </label>

          <div className="cc-action-row" style={{ marginTop: 4 }}>
            <button className="cc-btn-primary" onClick={signIn} disabled={loading || googleLoading} type="button">
              {loading ? "登入中…" : "登入"}
            </button>
            <Link href="/auth/signup" className="cc-btn">建立新帳號</Link>
          </div>

          {msg ? <div className={msg.includes("失效") ? "cc-note" : "cc-alert cc-alert-error"}>{msg}</div> : null}

          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.75 }}>
            Google 登入需要先在 Supabase 啟用 Google Provider，並設定正確的 Redirect URL。
          </p>
        </div>
      </section>
    </main>
  );
}
