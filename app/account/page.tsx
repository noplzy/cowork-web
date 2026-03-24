"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { TopNav } from "@/components/TopNav";
import { fetchAccountStatus, type AccountStatusResp, clearAccountStatusCache } from "@/lib/accountStatusClient";
import { getClientSessionSnapshot, invalidateClientSessionSnapshotCache } from "@/lib/clientAuth";

export default function AccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<AccountStatusResp | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await getClientSessionSnapshot();
      if (!session) {
        router.replace("/auth/login");
        return;
      }

      if (cancelled) return;
      setEmail(session.email);

      if (!session.accessToken) {
        setMsg("目前無法取得方案資訊，請重新登入後再試一次。");
        return;
      }

      try {
        const nextStatus = await fetchAccountStatus(session.accessToken);
        if (!cancelled) setStatus(nextStatus);
      } catch (error: any) {
        if (!cancelled) setMsg(error?.message ?? "讀取方案資訊失敗");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    invalidateClientSessionSnapshotCache();
    clearAccountStatusCache();
    router.replace("/auth/login");
  }

  return (
    <main className="cc-container">
      <TopNav email={email} onSignOut={signOut} />

      <section className="cc-hero">
        <div className="cc-card cc-hero-main">
          <span className="cc-kicker">Plan & Entitlements</span>
          <p className="cc-eyebrow">方案 / 額度｜把現在能用什麼看清楚</p>
          <h1 className="cc-h1">付費不是口號，而是看得懂、用得到的權益。</h1>
          <p className="cc-lead">
            這裡會清楚顯示你目前是免費方案還是 VIP、本月已使用多少、還剩多少，以及續場時會怎麼計算。
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
            <p className="cc-card-kicker">使用重點</p>
            <p className="cc-muted" style={{ margin: 0, lineHeight: 1.75 }}>
              開始一場前先看一眼自己的剩餘額度，續場前也能在這裡快速確認目前權益。
            </p>
          </div>
        </div>
      </section>

      {msg ? (
        <div className="cc-alert cc-alert-error cc-section">
          <strong>讀取失敗：</strong> {msg}
        </div>
      ) : null}

      {status ? (
        <section className="cc-section cc-grid-2">
          {status.is_vip ? (
            <article className="cc-card cc-stack-md">
              <div>
                <p className="cc-card-kicker">VIP 權益</p>
                <h2 className="cc-h2">你可以無限續場，不被場次打斷節奏。</h2>
              </div>
              <div className="cc-note">
                <div className="cc-stack-sm">
                  <div>Pair 續場：只要房內有 VIP，另一方也能一起續場。</div>
                  <div>Group 續場：每位想續場的使用者都需要具備 VIP。</div>
                  {status.vip_until ? <div>VIP 到期：{new Date(status.vip_until).toLocaleString()}</div> : null}
                </div>
              </div>
            </article>
          ) : (
            <article className="cc-card cc-stack-md">
              <div>
                <p className="cc-card-kicker">免費方案</p>
                <h2 className="cc-h2">先體驗整體節奏，再決定是否升級。</h2>
              </div>
              <div className="cc-note cc-stack-sm">
                <div>25m：消耗 1 場</div>
                <div>50m：消耗 2 場</div>
                <div>2 人房與 6 人房都採用相同場次規則</div>
                <div>本月剩餘 {status.credits_remaining ?? "?"}/{status.free_monthly_allowance} 場</div>
              </div>
              <p className="cc-muted" style={{ margin: 0, lineHeight: 1.7 }}>
                如果你想要不受場次限制地續場，升級 VIP 會是更順手的使用方式。
              </p>
            </article>
          )}

          <article className="cc-card cc-stack-md">
            <div>
              <p className="cc-card-kicker">這頁要解決的事</p>
              <h2 className="cc-h2">快速看懂，而不是自己猜。</h2>
            </div>
            <ul className="cc-bullets">
              <li>先知道自己目前是什麼方案。</li>
              <li>先知道本月還剩多少可用場次。</li>
              <li>先知道續場時會怎麼計算。</li>
            </ul>
          </article>
        </section>
      ) : (
        <section className="cc-section cc-card cc-empty-state">
          <div className="cc-stack-sm">
            <div className="cc-h3">正在讀取你的方案資訊</div>
            <div className="cc-muted">稍等一下，系統正在準備最新的權益資料。</div>
          </div>
        </section>
      )}
    </main>
  );
}
