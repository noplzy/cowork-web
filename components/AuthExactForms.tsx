"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { clearAccountStatusCache } from "@/lib/accountStatusClient";
import { invalidateClientSessionSnapshotCache } from "@/lib/clientAuth";

export function LoginExactForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    invalidateClientSessionSnapshotCache();
    clearAccountStatusCache();
    router.replace("/rooms");
  }

  async function google() {
    const redirectTo = `${window.location.origin}/auth/callback?next=/rooms`;
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo, queryParams: { prompt: "select_account" } } });
    if (error) setMsg(error.message);
  }

  return (
    <div className="i20x-auth-layer i20x-auth-login">
      <input className="i20x-auth-input i20x-login-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" />
      <input className="i20x-auth-input i20x-login-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="輸入密碼" type="password" autoComplete="current-password" />
      <button type="button" className="i20x-auth-button i20x-login-submit" onClick={signIn} disabled={loading}>{loading ? "登入中…" : ""}</button>
      <button type="button" className="i20x-auth-button i20x-login-google" onClick={google} aria-label="Google 登入" />
      <Link href="/auth/signup" className="i20x-hotspot" style={{ left: "75.4%", top: "73%", width: "8%", height: "4%" }} aria-label="立即註冊" />
      {msg ? <div className="i20x-auth-message">{msg}</div> : null}
    </div>
  );
}

export function SignupExactForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function signUp() {
    if (password !== confirm) {
      setMsg("兩次輸入的密碼不一致。");
      return;
    }
    setLoading(true);
    setMsg("");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: displayName ? { display_name: displayName } : undefined, emailRedirectTo: `${window.location.origin}/auth/callback?next=/rooms` },
    });
    setLoading(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    invalidateClientSessionSnapshotCache();
    clearAccountStatusCache();
    if (data.session) router.replace("/rooms");
    else setMsg("註冊完成。請依照信箱驗證設定完成驗證後登入。");
  }

  async function google() {
    const redirectTo = `${window.location.origin}/auth/callback?next=/rooms`;
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo, queryParams: { prompt: "select_account" } } });
    if (error) setMsg(error.message);
  }

  return (
    <div className="i20x-auth-layer i20x-auth-signup">
      <input className="i20x-auth-input i20x-signup-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" />
      <input className="i20x-auth-input i20x-signup-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="你希望我們怎麼稱呼你？" />
      <input className="i20x-auth-input i20x-signup-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="請輸入 8–20 位英數混合" type="password" autoComplete="new-password" />
      <input className="i20x-auth-input i20x-signup-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="再次輸入密碼" type="password" autoComplete="new-password" />
      <button type="button" className="i20x-auth-button i20x-signup-submit" onClick={signUp} disabled={loading}>{loading ? "建立中…" : ""}</button>
      <button type="button" className="i20x-auth-button i20x-signup-google" onClick={google} aria-label="Google 註冊" />
      <Link href="/auth/login" className="i20x-hotspot" style={{ left: "75.4%", top: "72.8%", width: "8%", height: "4%" }} aria-label="立即登入" />
      {msg ? <div className="i20x-auth-message i20x-auth-message-signup">{msg}</div> : null}
    </div>
  );
}
