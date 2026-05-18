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

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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

  async function signUp() {
    setMsg("");
    if (!email || !password) return setMsg("請先填寫 Email 與密碼。");
    if (password.length < 6) return setMsg("密碼至少需要 6 碼。");
    if (password !== confirm) return setMsg("兩次輸入的密碼不一致。");

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

      setMsg("註冊完成。若有開啟 Email 驗證，請先到信箱完成驗證。");
    } catch (e: any) {
      setMsg(e?.message || "註冊失敗。");
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
          queryParams: { access_type: "offline", prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch (e: any) {
      setGoogleLoading(false);
      setMsg(e?.message || "Google 註冊啟動失敗。");
    }
  }

  return (
    <main className={styles.authPage} data-image20-dom-page="signup-v11-template-aligned">
      <div className={styles.authBackdrop} aria-hidden="true" />

      <section className={styles.authStage}>
        <article className={styles.authStory}>
          <div className={styles.authLogo}>
            <Image20Logo />
          </div>

          <div className={styles.authStoryCopy}>
            <span className="i20-kicker">Signup</span>
            <h1 className="i20-serif">從這裡開始，慢慢找到陪伴節奏。</h1>
            <p>
              免費加入後可進入 Rooms、管理排程，並為後續身份驗證與安感夥伴服務做好準備。
            </p>
          </div>
        </article>

        <aside className={styles.authCard}>
          <span className="i20-kicker">加入安感島</span>
          <h2 className="i20-serif">建立你的帳號</h2>
          <p>先用 Google 或 Email / Password 建立基本帳號。</p>

          <div className={styles.authActionStack}>
            <button
              className="i20-btn"
              onClick={signUpWithGoogle}
              disabled={googleLoading || loading}
            >
              {googleLoading ? "正在前往 Google…" : "使用 Google 註冊"}
            </button>

            <div className={styles.authDivider}>
              <span />
              <b>或</b>
              <span />
            </div>

            <div className="i20-field">
              <label>暱稱（可選）</label>
              <input
                className="i20-input"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                autoComplete="nickname"
              />
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
                autoComplete="new-password"
              />
            </div>

            <div className="i20-field">
              <label>確認密碼</label>
              <input
                className="i20-input"
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
              />
            </div>

            <button
              className="i20-btn peach"
              onClick={signUp}
              disabled={loading || googleLoading}
            >
              {loading ? "建立中…" : "建立帳號"}
            </button>

            {msg ? <div className={styles.authMessage}>{msg}</div> : null}

            <div className={styles.authSwitchRow}>
              <span>已經有帳號？</span>
              <Link href="/auth/login">立即登入</Link>
            </div>
          </div>

          <div className={styles.authTrustGrid}>
            <div>
              <b>每月免費體驗</b>
              <span>先理解 Rooms，再決定使用節奏。</span>
            </div>
            <div>
              <b>身份流程清楚</b>
              <span>後續驗證會集中在帳號中心。</span>
            </div>
            <div>
              <b>客服入口明確</b>
              <span>有問題時能快速找到支援。</span>
            </div>
          </div>
        </aside>
      </section>

      <footer className={styles.authFooter}>
        <span>© 安感島 Calm&amp;Co</span>
        <nav aria-label="註冊頁頁尾">
          <Link href="/terms">服務條款</Link>
          <Link href="/privacy">隱私權政策</Link>
          <Link href="/pricing">方案 / 價格</Link>
          <Link href="/contact">客服</Link>
        </nav>
      </footer>
    </main>
  );
}
