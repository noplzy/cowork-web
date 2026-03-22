// app/account/page.tsx
// ✅ Milestone 3: 方案/額度頁（MVP：顯示狀態 + 後續串金流的入口）

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { TopNav } from "@/components/TopNav";

type StatusResp = {
  plan: string;
  is_vip: boolean;
  vip_until: string | null;
  free_monthly_allowance: number;
  credits_used: number;
  credits_remaining: number | null;
  month_start: string;
};

export default function AccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      setEmail(user.email ?? "");

      const { data: sessionData } = await supabase.auth.getSession();
      const access = sessionData.session?.access_token;
      if (!access) return;

      const r = await fetch("/api/account/status", {
        headers: { Authorization: `Bearer ${access}` },
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        setMsg(j?.error ?? "讀取方案失敗");
        return;
      }
      setStatus(j as StatusResp);
    })();
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  return (
    <main className="cc-container" style={{ maxWidth: 920 }}>
      <TopNav email={email} onSignOut={signOut} />

      <h1 className="cc-h1" style={{ marginTop: 6 }}>方案 / 額度</h1>
      <div className="cc-muted" style={{ lineHeight: 1.7, maxWidth: 860 }}>
        這頁是 MVP 的帳號狀態頁：顯示 plan、每月免費額度、已使用與剩餘。之後金流 webhook 成功後，
        只要把 Supabase 的 <code>user_entitlements.plan</code> 更新成 <code>vip</code>，前端就會立即生效。
      </div>

      {status && (
        <div style={{ marginTop: 16, border: "1px solid rgba(255,255,255,0.18)", borderRadius: 12, padding: 14 }}>
          <p style={{ marginTop: 0, marginBottom: 10, opacity: 0.85 }}>
            週起點：{status.month_start}
          </p>

          {status.is_vip ? (
            <>
              <h2 style={{ margin: 0 }}>VIP（單一方案）</h2>
              <p style={{ marginTop: 8, opacity: 0.85 }}>
                你可以無限續場（房間不關、每 25/50 分鐘一個自然段落）。
              </p>
              {status.vip_until && (
                <p style={{ opacity: 0.85 }}>VIP 到期：{new Date(status.vip_until).toLocaleString()}</p>
              )}
              <div style={{ marginTop: 10, opacity: 0.85 }}>
                <div>Pair 續命：只要房內有 VIP，在場另一方也可續場。</div>
                <div>Group 續命：每個人要續場都要自己是 VIP。</div>
              </div>
            </>
          ) : (
            <>
              <h2 style={{ margin: 0 }}>免費</h2>
              <p style={{ marginTop: 8, opacity: 0.85 }}>
                本月剩餘 {status.credits_remaining ?? "?"}/{status.free_monthly_allowance} 場
              </p>
              <div style={{ opacity: 0.85 }}>
                <div>25m：消耗 1 場</div>
                <div>50m：消耗 2 場</div>
                <div>2 人房/6 人房：都算同一種「場」的額度規則</div>
              </div>

              <hr style={{ margin: "14px 0", opacity: 0.2 }} />

              <p style={{ opacity: 0.85 }}>
                升級 VIP（尚未串金流）：現在先用 Supabase Table Editor 把你的 plan 改成 vip 測試。
              </p>
            </>
          )}
        </div>
      )}
    </main>
  );
}
