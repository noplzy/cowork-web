"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { clearAccountStatusCache } from "@/lib/accountStatusClient";
import { invalidateClientSessionSnapshotCache } from "@/lib/clientAuth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setMsg(error.message);

    invalidateClientSessionSnapshotCache();
    clearAccountStatusCache();
    router.push("/rooms");
  }

  async function signUp() {
    setLoading(true);
    setMsg("");
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) return setMsg(error.message);
    setMsg("註冊成功：如果你的帳號需要 Email 驗證，請先到信箱完成確認後再登入。");
  }

  return (
    <main className="cc-login-shell">
      <section className="cc-login-grid">
        <div className="cc-card cc-hero-main cc-stack-lg">
          <span className="cc-kicker">Welcome to 安感島</span>
          <p className="cc-eyebrow">登入 / 註冊｜進入低壓力共工與陪伴型數位空間</p>
          <h1 className="cc-h1">不用先很厲害，先進來就好。</h1>
          <p className="cc-lead" style={{ marginTop: 0 }}>
            安感島想提供的不是高壓衝刺感，而是一個讓你願意慢慢回到節奏的地方。
            登入後，你可以直接前往 Rooms 開始一段新的共工時間。
          </p>
          <div className="cc-grid-metrics">
            <div className="cc-metric">
              <span className="cc-metric-label">專注主線</span>
              <div className="cc-metric-value" style={{ fontSize: "1.1rem" }}>Rooms</div>
            </div>
            <div className="cc-metric">
              <span className="cc-metric-label">陪伴方向</span>
              <div className="cc-metric-value" style={{ fontSize: "1.1rem" }}>Buddies</div>
            </div>
            <div className="cc-metric">
              <span className="cc-metric-label">整體感受</span>
              <div className="cc-metric-value" style={{ fontSize: "1.1rem" }}>Calm Premium</div>
            </div>
          </div>
          <Link href="/" className="cc-btn-link">回到首頁 →</Link>
        </div>

        <div className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">開始登入</p>
            <h2 className="cc-h2">登入後直接進入 Rooms</h2>
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
              placeholder="至少 6 碼"
              autoComplete="current-password"
            />
          </label>

          <div className="cc-action-row" style={{ marginTop: 4 }}>
            <button className="cc-btn-primary" onClick={signIn} disabled={loading} type="button">
              {loading ? "處理中…" : "登入"}
            </button>
            <button className="cc-btn" onClick={signUp} disabled={loading} type="button">
              {loading ? "處理中…" : "註冊"}
            </button>
          </div>

          {msg ? (
            <div className={msg.includes("成功") ? "cc-note" : "cc-alert cc-alert-error"}>
              {msg}
            </div>
          ) : null}

          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.75 }}>
            登入後就能查看你的方案狀態、房間列表與目前可用額度。
          </p>
        </div>
      </section>
    </main>
  );
}
