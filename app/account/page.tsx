"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { clearAccountStatusCache, fetchAccountStatus, type AccountStatusResp } from "@/lib/accountStatusClient";
import { getClientSessionSnapshot, invalidateClientSessionSnapshotCache } from "@/lib/clientAuth";
import { Image20Logo } from "@/components/image20/Image20Chrome";
import styles from "@/components/image20/Image20Auxiliary.module.css";

const dashboardLinks = [
  ["/account", "我的中心"],
  ["/rooms", "同行空間"],
  ["/schedule", "排程"],
  ["/friends", "好友"],
  ["/account/identity", "身份驗證"],
  ["/pricing", "方案 / 價格"],
  ["/contact", "客服"],
] as const;

function formatVipUntil(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function billingLabel(status: AccountStatusResp | null) {
  if (!status) return "讀取中";
  if (status.is_vip) return status.billing_mode === "subscription" ? "訂閱方案" : "已啟用方案";
  return "免費方案";
}

export default function AccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<AccountStatusResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await getClientSessionSnapshot().catch(() => null);
      if (!session) {
        router.replace("/auth/login?next=/account");
        return;
      }
      if (cancelled) return;

      setEmail(session.email);

      if (session.accessToken) {
        setStatus(await fetchAccountStatus(session.accessToken).catch(() => null));
      }
      setLoading(false);
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

  const planName = status?.is_vip ? "VIP" : "免費體驗";
  const creditsRemaining = status?.is_vip ? "∞" : String(status?.credits_remaining ?? "—");
  const creditsUsed = String(status?.credits_used ?? "—");
  const allowance = String(status?.free_monthly_allowance ?? "—");
  const vipUntil = useMemo(() => formatVipUntil(status?.vip_until), [status?.vip_until]);

  return (
    <main className={styles.accountDashboard} data-image20-dom-page="account-center-v11-template-aligned">
      <aside className={styles.accountSidebar}>
        <Image20Logo />

        <nav aria-label="帳號中心導覽" className={styles.accountSideNav}>
          {dashboardLinks.map(([href, label]) => (
            <Link key={href} href={href} className={href === "/account" ? styles.accountSideActive : undefined}>
              {label}
            </Link>
          ))}
        </nav>

        <div className={styles.accountSidebarNote}>
          <b>在安感島，你可以放心做自己。</b>
          <span>有疑問時，客服與公開規則都會保持可找到。</span>
        </div>

        <button className={styles.accountSignOut} type="button" onClick={signOut}>
          登出
        </button>
      </aside>

      <section className={styles.accountMain}>
        <header className={styles.accountTopbar}>
          <div>
            <span>我的島</span>
            <b>{email || "正在讀取帳號資訊…"}</b>
          </div>
          <div className={styles.accountTopActions}>
            <Link href="/rooms">探索房間</Link>
            <Link href="/schedule">查看排程</Link>
          </div>
        </header>

        <section className={styles.accountHero}>
          <div className={styles.accountHeroBackdrop} aria-hidden="true" />
          <div className={styles.accountHeroCopy}>
            <span className="i20-kicker">Account Center</span>
            <h1 className="i20-serif">歡迎回來，這裡是你的安感島。</h1>
            <p>查看方案狀態、身份驗證、同行額度與接下來要處理的事情。</p>
          </div>
          <aside className={styles.accountHeroQuote}>
            <b>不需要急著開始。</b>
            <span>先確認今天想用什麼節奏前進。</span>
          </aside>
        </section>

        <section className={styles.accountProfileGrid}>
          <article className={styles.accountProfileCard}>
            <div className={styles.accountAvatar}>島</div>
            <div>
              <span className="i20-kicker">Profile</span>
              <h2 className="i20-serif">你的安感島帳號</h2>
              <p>{email || "讀取中…"}</p>
              <Link href="/account/identity">查看身份驗證 →</Link>
            </div>
          </article>

          <article className={styles.accountPlanCard}>
            <span className="i20-kicker">Plan</span>
            <h2 className="i20-serif">{planName}</h2>
            <div className={styles.accountPlanMeta}>
              <span>方案狀態：{billingLabel(status)}</span>
              <span>本月剩餘額度：{creditsRemaining}</span>
              {vipUntil ? <span>VIP 到期日：{vipUntil}</span> : null}
            </div>
            <Link href="/pricing">管理方案 →</Link>
          </article>
        </section>

        <section className={styles.accountMetricGrid}>
          <article className={styles.accountMetricCard}>
            <span className="i20-kicker">Monthly</span>
            <h3>本月額度使用</h3>
            <b>{creditsUsed} / {allowance}</b>
            <p>{status?.is_vip ? "VIP 方案不受免費額度限制。" : "免費額度用量會依本月進房情況更新。"}</p>
            <Link href="/rooms">前往同行空間 →</Link>
          </article>

          <article className={styles.accountMetricCard}>
            <span className="i20-kicker">Identity</span>
            <h3>身份驗證進度</h3>
            <b>查看驗證流程</b>
            <p>手機驗證已可使用，證件驗證與審核區位也會集中在此路徑。</p>
            <Link href="/account/identity">前往驗證 →</Link>
          </article>

          <article className={styles.accountMetricCard}>
            <span className="i20-kicker">Privacy</span>
            <h3>安全與隱私</h3>
            <b>規則與保護</b>
            <p>平台規則、隱私政策與客服入口，都應該讓你隨時找得到。</p>
            <Link href="/privacy">查看政策 →</Link>
          </article>
        </section>

        <section className={styles.accountContentGrid}>
          <article className={styles.accountContentCard}>
            <div className={styles.accountContentHead}>
              <div>
                <span className="i20-kicker">Schedule</span>
                <h3>即將開始的同行</h3>
              </div>
              <Link href="/schedule">查看全部</Link>
            </div>
            <div className={styles.accountEmptyState}>
              <b>排程資訊會在這裡整理。</b>
              <p>目前可先前往排程頁查看與後續管理即將開始的同行。</p>
            </div>
          </article>

          <article className={styles.accountContentCard}>
            <div className={styles.accountContentHead}>
              <div>
                <span className="i20-kicker">AI Companion</span>
                <h3>AI 夥伴偏好</h3>
              </div>
            </div>
            <div className={styles.accountPreferenceList}>
              <div>
                <b>全站 AI 夥伴</b>
                <span>入口與建議會在正式功能開放後集中管理。</span>
              </div>
              <div>
                <b>房內 AI 模式</b>
                <span>Shared Host AI / Personal Room AI 的偏好位置先保留。</span>
              </div>
            </div>
          </article>

          <aside className={styles.accountSupportStack}>
            <article>
              <span className="i20-kicker">Help</span>
              <h3>需要協助？</h3>
              <p>客服頁會整理表單、官方信箱與安全支援入口。</p>
              <Link href="/contact">聯絡客服 →</Link>
            </article>
            <article>
              <span className="i20-kicker">Refund</span>
              <h3>退款政策</h3>
              <p>先看清楚方案異動與退款原則，再決定下一步。</p>
              <Link href="/refund-policy">查看政策 →</Link>
            </article>
          </aside>
        </section>

        {loading ? <div className={styles.accountLoading}>正在準備帳號中心…</div> : null}
      </section>
    </main>
  );
}
