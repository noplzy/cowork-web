"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { clearAccountStatusCache } from "@/lib/accountStatusClient";
import { getClientSessionSnapshot, invalidateClientSessionSnapshotCache } from "@/lib/clientAuth";
import { Image20Logo } from "@/components/image20/Image20Chrome";

export default function LoginPage(){
  const router=useRouter(); const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [msg,setMsg]=useState(""); const [loading,setLoading]=useState(false); const [googleLoading,setGoogleLoading]=useState(false);
  useEffect(()=>{let cancelled=false;(async()=>{const session=await getClientSessionSnapshot().catch(()=>null); if(!cancelled&&session) router.replace("/rooms");})(); return()=>{cancelled=true};},[router]);
  async function signIn(){setLoading(true);setMsg("");try{const {error}=await supabase.auth.signInWithPassword({email,password}); if(error) throw error; invalidateClientSessionSnapshotCache(); clearAccountStatusCache(); router.replace("/rooms");}catch(e:any){setMsg(e?.message||"登入失敗，請稍後再試。");}finally{setLoading(false)}}
  async function signInWithGoogle(){setGoogleLoading(true);setMsg("");try{const redirectTo=`${window.location.origin}/auth/callback?next=/rooms`; const {error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo,queryParams:{access_type:"offline",prompt:"select_account"}}}); if(error) throw error;}catch(e:any){setGoogleLoading(false);setMsg(e?.message||"Google 登入啟動失敗。");}}
  return <main className="i20-auth" data-image20-dom-page="login-v6"><section className="i20-auth-art"><div style={{position:"absolute",zIndex:3,left:34,top:30,color:"#fff"}}><Image20Logo /></div><div className="i20-auth-copy"><span className="i20-kicker">Login</span><h1>回到安感島，讓自己慢慢安定下來。</h1><p>登入後可進入同行空間、查看排程與管理你的安感島。</p></div></section><section className="i20-auth-card"><span className="i20-kicker">歡迎回來</span><h2 className="i20-serif">登入你的帳號</h2><p className="i20-muted">使用 Google 或 Email / Password 進入。</p><div className="i20-list"><button className="i20-btn" onClick={signInWithGoogle} disabled={googleLoading||loading}>{googleLoading?"正在前往 Google…":"使用 Google 登入"}</button><div className="i20-field"><label>Email</label><input className="i20-input" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" /></div><div className="i20-field"><label>Password</label><input className="i20-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" /></div><button className="i20-btn peach" onClick={signIn} disabled={loading||googleLoading}>{loading?"登入中…":"登入"}</button>{msg?<div className="i20-panel" style={{color:"#a43d2f"}}>{msg}</div>:null}<div className="i20-softbar"><span>還沒有帳號？</span><Link href="/auth/signup" className="i20-btn light">建立帳號</Link></div></div></section></main>
}
