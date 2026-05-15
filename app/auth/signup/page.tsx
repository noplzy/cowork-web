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
    <main className="i20-auth" data-image20-dom-page="signup-v9-extra9">
      <section className="i20-auth-art">
        <div style={{ position: "absolute", zIndex: 3, left: 34, top: 30, color: "#fff" }}>
          <Image20Logo />
        </div>

        <div className="i20-auth-copy">
          <span className="i20-kicker">Signup</span>
          <h1>從這裡開始，慢慢找到陪伴節奏。</h1>
          <p>建立帳號後可進入 Rooms、管理排程，並為後續安感夥伴服務做好準備。</p>

          <div className={styles.authBrandList}>
            <div>先加入，不急著表現；安感島從低壓力開始。</div>
            <div>登入後可查看房間、身份驗證與自己的排程。</div>
          </div>
        </div>
      </section>

      <section className="i20-auth-card">
        <span className="i20-kicker">加入安感島</span>
        <h2 className="i20-serif">建立你的帳號</h2>

        <div className="i20-list">
          <button className="i20-btn" onClick={signUpWithGoogle} disabled={googleLoading || loading}>
            {googleLoading ? "正在前往 Google…" : "使用 Google 註冊"}
          </button>

          <div className="i20-field">
            <label>暱稱（可選）</label>
            <input
              className="i20-input"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>

          <div className="i20-field">
            <label>Email</label>
            <input
              className="i20-input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
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

          <button className="i20-btn peach" onClick={signUp} disabled={loading || googleLoading}>
            {loading ? "建立中…" : "完成註冊"}
          </button>

          {msg ? (
            <div className="i20-panel" style={{ color: msg.includes("完成") ? "#31684f" : "#a43d2f" }}>
              {msg}
            </div>
          ) : null}

          <div className="i20-softbar">
            <span>已經有帳號？</span>
            <Link href="/auth/login" className="i20-btn light">
              前往登入
            </Link>
          </div>
        </div>

        <div className={styles.authTrust}>
          <span className={styles.authTrustItem}>Google 或 Email</span>
          <span className={styles.authTrustItem}>先註冊，再慢慢補齊身份</span>
          <span className={styles.authTrustItem}>方案與規則可先看清楚</span>
        </div>

        <div className={styles.authLegal}>
          <Link href="/terms">服務條款</Link>
          <Link href="/privacy">隱私權政策</Link>
          <Link href="/pricing">方案 / 價格</Link>
        </div>
      </section>
    </main>
  );
}
