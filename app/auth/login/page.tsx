"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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
    router.push("/rooms");
  }

  async function signUp() {
    setLoading(true);
    setMsg("");
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) return setMsg(error.message);
    setMsg("註冊成功：若你開啟 Email confirmation，請先去信箱點確認連結再登入。");
  }

  return (
    <main className="cc-login-shell">
      <section className="cc-login-grid">
        <div className="cc-card cc-hero-main cc-stack-lg">
          <span className="cc-kicker">Welcome to 安感島</span>
          <p className="cc-eyebrow">登入 / 註冊｜進入低壓力共工與陪伴型數位空間</p>
          <h1 className="cc-h1">不用先很厲害，先進來就好。</h1>
          <p className="cc-lead" style={{ marginTop: 0 }}>
            安感島想做的不是讓你被逼著振作，而是讓你在狀態很普通、甚至有點亂的時候，
            仍然有地方可以慢慢回到節奏。登入後你會進入 Rooms 主線；如果你只是想先看看，首頁也保留雙入口說明。
          </p>
          <div className="cc-grid-metrics">
            <div className="cc-metric">
              <span className="cc-metric-label">專注主線</span>
              <div className="cc-metric-value" style={{ fontSize: "1.1rem" }}>Rooms</div>
            </div>
            <div className="cc-metric">
              <span className="cc-metric-label">陪伴主線</span>
              <div className="cc-metric-value" style={{ fontSize: "1.1rem" }}>Buddies</div>
            </div>
            <div className="cc-metric">
              <span className="cc-metric-label">品牌氣質</span>
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
              placeholder="至少 6–8 碼（依 Supabase 設定）"
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
            這裡目前先保留最小可用登入。後續若做社群登入、密碼重設與更細的錯誤訊息，也應沿用同一套安感島視覺語言。
          </p>
        </div>
      </section>
    </main>
  );
}
