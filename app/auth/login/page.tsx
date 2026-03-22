"use client";

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
    setMsg("註冊成功：若你開啟 Email confirmation，請去信箱點確認連結後再登入。");
  }

  return (
    <main style={{ padding: 24, maxWidth: 420 }}>
      <h1>Login</h1>

      <label style={{ display: "block", marginTop: 12 }}>
        Email
        <input className="cc-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: 8, marginTop: 6 }}
          placeholder="you@example.com"
        />
      </label>

      <label style={{ display: "block", marginTop: 12 }}>
        Password
        <input className="cc-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          style={{ width: "100%", padding: 8, marginTop: 6 }}
          placeholder="至少 6-8 碼（依你在 Supabase 的設定）"
        />
      </label>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button className="cc-btn cc-btn-primary" onClick={signIn} disabled={loading} type="button">
          {loading ? "..." : "登入"}
        </button>
        <button className="cc-btn" onClick={signUp} disabled={loading} type="button">
          {loading ? "..." : "註冊"}
        </button>
      </div>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
      <p style={{ marginTop: 16, opacity: 0.7 }}>
        Step 2 先做最小可用登入；之後再做漂亮 UI + 錯誤處理。
      </p>
    </main>
  );
}
