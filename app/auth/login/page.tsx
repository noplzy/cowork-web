"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { clearAccountStatusCache } from "@/lib/accountStatusClient";
import {
  getClientSessionSnapshot,
  invalidateClientSessionSnapshotCache,
} from "@/lib/clientAuth";
import { Image20Logo } from "@/components/image20/Image20Chrome";
import styles from "@/components/image20/Image20Auxiliary.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await getClientSessionSnapshot().catch(() => null);
      if (!cancelled && session) router.replace("/rooms");
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function signIn() {
    setLoading(true);
    setMsg("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      invalidateClientSessionSnapshotCache();
      clearAccountStatusCache();
      router.replace("/rooms");
    } catch (e: any) {
      setMsg(e?.message || "登入失敗，請稍後再試。");
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
          queryParams: { access_type: "offline", prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch (e: any) {
      setGoogleLoading(false);
      setMsg(e?.message || "Google 登入啟動失敗。");
    }
  }

  return (
    <main className={styles.authPage} data-image20-dom-page="login-v11-template-aligned">
      <div className={styles.authBackdrop} aria-hidden="true" />

      <section className={styles.authStage}>
        <article className={styles.authStory}>
          <div className={styles.authLogo}>
            <Image20Logo />
          </div>

          <div className={styles.authStoryCopy}>
            <span className="i20-kicker">Login</span>
            <h1 className="i20-serif">回到安感島，讓自己慢慢安定下來。</h1>
            <p>
              登入後可進入同行空間、查看排程與管理自己的安感島。
              這裡不是催促開始，而是讓你安心接續上一次的節奏。
            </p>
          </div>
        </article>

        <aside className={styles.authCard}>
          <span className="i20-kicker">歡迎回來</span>
          <h2 className="i20-serif">登入你的帳號</h2>
          <p>使用 Google 或 Email / Password 進入。</p>

          <div className={styles.authActionStack}>
            <button
              className="i20-btn"
              onClick={signInWithGoogle}
              disabled={googleLoading || loading}
            >
              {googleLoading ? "正在前往 Google…" : "使用 Google 登入"}
            </button>

            <div className={styles.authDivider}>
              <span />
              <b>或</b>
              <span />
            </div>

            <div className="i20-field">
              <label>Email</label>
              <input
                className="i20-input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                inputMode="email"
              />
            </div>

            <div className="i20-field">
              <label>Password</label>
              <input
                className="i20-input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>

            <button
              className="i20-btn peach"
              onClick={signIn}
              disabled={loading || googleLoading}
            >
              {loading ? "登入中…" : "登入安感島"}
            </button>

            {msg ? <div className={styles.authMessage}>{msg}</div> : null}

            <div className={styles.authSwitchRow}>
              <span>還沒有帳號？</span>
              <Link href="/auth/signup">立即註冊</Link>
            </div>
          </div>

          <div className={styles.authTrustGrid}>
            <div>
              <b>隱私安心</b>
              <span>平台規則與政策入口清楚可查。</span>
            </div>
            <div>
              <b>進房前先理解</b>
              <span>先熟悉流程，再決定今天怎麼開始。</span>
            </div>
            <div>
              <b>客服可找到</b>
              <span>遇到帳號問題，可以直接聯絡我們。</span>
            </div>
          </div>
        </aside>
      </section>

      <footer className={styles.authFooter}>
        <span>© 安感島 Calm&amp;Co</span>
        <nav aria-label="登入頁頁尾">
          <Link href="/terms">服務條款</Link>
          <Link href="/privacy">隱私權政策</Link>
          <Link href="/contact">客服</Link>
        </nav>
      </footer>
    </main>
  );
}
