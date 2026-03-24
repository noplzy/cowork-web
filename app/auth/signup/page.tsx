"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { clearAccountStatusCache } from "@/lib/accountStatusClient";
import { getClientSessionSnapshot, invalidateClientSessionSnapshotCache } from "@/lib/clientAuth";

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await getClientSessionSnapshot().catch(() => null);
      if (!cancelled && session) {
        router.replace("/rooms");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function signUp() {
    setMsg("");

    if (!email || !password) {
      setMsg("請先填寫 Email 與密碼。");
      return;
    }
    if (password.length < 6) {
      setMsg("密碼至少需要 6 碼。");
      return;
    }
    if (password !== confirmPassword) {
      setMsg("兩次輸入的密碼不一致。");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: displayName ? { display_name: displayName } : undefined,
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/rooms`,
        },
      });

      if (error) throw error;

      invalidateClientSessionSnapshotCache();
      clearAccountStatusCache();

      if (data.session) {
        router.replace("/rooms");
        return;
      }

      setMsg("註冊完成。若你有開啟 Email 驗證，請先到信箱完成驗證後再登入。");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "註冊失敗，請稍後再試。");
    } finally {
      setLoading(false);
    }
  }

  async function signUpWithGoogle() {
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
      setMsg(error instanceof Error ? error.message : "Google 註冊啟動失敗，請稍後再試。");
    }
  }

  return (
    <main className="cc-login-shell">
      <section className="cc-login-grid">
        <div className="cc-card cc-hero-main cc-stack-lg">
          <span className="cc-kicker">Create your account</span>
          <p className="cc-eyebrow">註冊｜第一次進站也要自然</p>
          <h1 className="cc-h1">註冊頁就只做註冊，不再混成登入頁。</h1>
          <p className="cc-lead" style={{ marginTop: 0 }}>
            你可以先用 Google 快速建立帳號，也可以使用 Email / Password 註冊。
            已登入的使用者不應再停留在這頁。
          </p>

          <div className="cc-grid-metrics">
            <div className="cc-metric">
              <span className="cc-metric-label">Google</span>
              <div className="cc-metric-value" style={{ fontSize: "1.1rem" }}>快速建立</div>
            </div>
            <div className="cc-metric">
              <span className="cc-metric-label">Email</span>
              <div className="cc-metric-value" style={{ fontSize: "1.1rem" }}>一般註冊</div>
            </div>
            <div className="cc-metric">
              <span className="cc-metric-label">已有帳號？</span>
              <div className="cc-metric-value" style={{ fontSize: "1.1rem" }}>前往登入</div>
            </div>
          </div>

          <div className="cc-action-row">
            <Link href="/auth/login" className="cc-btn">已有帳號，前往登入</Link>
            <Link href="/" className="cc-btn-link">回到首頁 →</Link>
          </div>
        </div>

        <div className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">建立新帳號</p>
            <h2 className="cc-h2">先用最順手的方式開始</h2>
          </div>

          <button
            className="cc-btn"
            onClick={signUpWithGoogle}
            disabled={googleLoading || loading}
            type="button"
            style={{ width: "100%", minHeight: 48, fontWeight: 600 }}
          >
            {googleLoading ? "正在前往 Google…" : "使用 Google 註冊"}
          </button>

          <div className="cc-row" style={{ gap: 12, alignItems: "center" }}>
            <div className="cc-soft-divider" style={{ margin: 0 }} />
            <span className="cc-caption" style={{ whiteSpace: "nowrap" }}>或使用 Email 註冊</span>
            <div className="cc-soft-divider" style={{ margin: 0 }} />
          </div>

          <label className="cc-field">
            <span className="cc-field-label">暱稱（可選）</span>
            <input
              className="cc-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="你的顯示名稱"
            />
          </label>

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
              placeholder="至少 6 碼"
              autoComplete="new-password"
            />
          </label>

          <label className="cc-field">
            <span className="cc-field-label">確認密碼</span>
            <input
              className="cc-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type="password"
              placeholder="再輸入一次密碼"
              autoComplete="new-password"
            />
          </label>

          <div className="cc-action-row" style={{ marginTop: 4 }}>
            <button className="cc-btn-primary" onClick={signUp} disabled={loading || googleLoading} type="button">
              {loading ? "建立中…" : "完成註冊"}
            </button>
            <Link href="/auth/login" className="cc-btn">前往登入</Link>
          </div>

          {msg ? (
            <div className={msg.includes("完成") ? "cc-note" : "cc-alert cc-alert-error"}>
              {msg}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
