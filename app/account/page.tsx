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
    <main className="cc-container">
      <TopNav email={email} onSignOut={signOut} />

      <section className="cc-hero">
        <div className="cc-card cc-hero-main">
          <span className="cc-kicker">Plan & Entitlements</span>
          <p className="cc-eyebrow">方案 / 額度｜讓規則先被看懂，再決定要不要升級</p>
          <h1 className="cc-h1">付費不是抽象承諾，而是看得懂的可用權益。</h1>
          <p className="cc-lead">
            這頁是安感島的信任頁之一。它不該看起來像後台殘骸，而要清楚說明你現在是 FREE 還是 VIP、
            本月還剩多少場、續場邏輯是什麼，以及之後金流 webhook 成功時，前端會如何立即生效。
          </p>
          <div className="cc-action-row">
            <Link className="cc-btn" href="/rooms">
              回到 Rooms
            </Link>
          </div>
        </div>

        <div className="cc-hero-side">
          <div className="cc-card cc-stack-md">
            <div className="cc-card-row">
              <div>
                <p className="cc-card-kicker">目前方案</p>
                <h2 className="cc-h2">{status?.is_vip ? "VIP 單一方案" : "免費方案"}</h2>
              </div>
              <span className={status?.is_vip ? "cc-pill-success" : "cc-pill-warning"}>
                {status?.is_vip ? "VIP" : "FREE"}
              </span>
            </div>

            <div className="cc-grid-metrics">
              <div className="cc-metric">
                <span className="cc-metric-label">週期起點</span>
                <div className="cc-metric-value" style={{ fontSize: "1.15rem" }}>{status?.month_start ?? "讀取中"}</div>
              </div>
              <div className="cc-metric">
                <span className="cc-metric-label">已使用</span>
                <div className="cc-metric-value">{status?.credits_used ?? "-"}</div>
              </div>
              <div className="cc-metric">
                <span className="cc-metric-label">剩餘</span>
                <div className="cc-metric-value">{status?.is_vip ? "∞" : (status?.credits_remaining ?? "-")}</div>
              </div>
            </div>
          </div>

          <div className="cc-card cc-card-soft cc-stack-sm">
            <p className="cc-card-kicker">金流接上後</p>
            <p className="cc-muted" style={{ margin: 0, lineHeight: 1.75 }}>
              後端只要把 <span className="cc-code">user_entitlements.plan</span> 更新成 <span className="cc-code">vip</span>，
              前端就應立即反映對應權益。這頁的任務是把規則說清楚，不是藏規則。
            </p>
          </div>
        </div>
      </section>

      {msg ? (
        <div className="cc-alert cc-alert-error cc-section">
          <strong>讀取錯誤：</strong> {msg}
        </div>
      ) : null}

      {status ? (
        <section className="cc-section cc-grid-2">
          {status.is_vip ? (
            <article className="cc-card cc-stack-md">
              <div>
                <p className="cc-card-kicker">VIP 權益</p>
                <h2 className="cc-h2">你可以無限續場，不被場次擋住節奏。</h2>
              </div>
              <div className="cc-note">
                <div className="cc-stack-sm">
                  <div>Pair 續命：只要房內有 VIP，在場另一方也可續場。</div>
                  <div>Group 續命：每個人要續場都要自己是 VIP。</div>
                  {status.vip_until ? <div>VIP 到期：{new Date(status.vip_until).toLocaleString()}</div> : null}
                </div>
              </div>
            </article>
          ) : (
            <article className="cc-card cc-stack-md">
              <div>
                <p className="cc-card-kicker">免費方案</p>
                <h2 className="cc-h2">先讓你能體驗，但規則必須透明。</h2>
              </div>
              <div className="cc-note cc-stack-sm">
                <div>25m：消耗 1 場</div>
                <div>50m：消耗 2 場</div>
                <div>2 人房 / 6 人房：都算同一種「場」規則</div>
                <div>本月剩餘 {status.credits_remaining ?? "?"}/{status.free_monthly_allowance} 場</div>
              </div>
              <p className="cc-muted" style={{ margin: 0, lineHeight: 1.7 }}>
                升級 VIP 尚未接上金流時，可先用 Supabase Table Editor 把 plan 改成 <span className="cc-code">vip</span> 做驗證。
              </p>
            </article>
          )}

          <article className="cc-card cc-stack-md">
            <div>
              <p className="cc-card-kicker">這頁應該帶來什麼感覺</p>
              <h2 className="cc-h2">可信，而不是花言巧語。</h2>
            </div>
            <ul className="cc-bullets">
              <li>使用者要快速知道自己是什麼方案、剩多少、怎麼續場。</li>
              <li>付款前後不能出現規則不一致，不然信任會直接掉下去。</li>
              <li>之後金流、過審、客服政策頁都要沿用同一套 calm premium 視覺語言。</li>
            </ul>
          </article>
        </section>
      ) : (
        <section className="cc-section cc-card cc-empty-state">
          <div className="cc-stack-sm">
            <div className="cc-h3">正在讀取你的方案資訊</div>
            <div className="cc-muted">稍等一下，前端正在向 /api/account/status 拉回目前 entitlement。</div>
          </div>
        </section>
      )}
    </main>
  );
}
