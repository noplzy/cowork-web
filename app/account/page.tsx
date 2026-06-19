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
  ["/account/profile", "個人檔案"],
  ["/account/identity", "手機驗證"],
  ["/account/identity/bindings", "身分綁定"],
  ["/rooms", "同行空間"],
  ["/buddies", "安感夥伴"],
  ["/schedule", "排程"],
  ["/friends", "好友"],
  ["/pricing", "方案 / 價格"],
  ["/contact", "客服"],
] as const;

function formatVipUntil(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
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
  const [isAdmin, setIsAdmin] = useState(false);

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
        const [accountStatus, adminStatus] = await Promise.all([
          fetchAccountStatus(session.accessToken).catch(() => null),
          fetch("/api/admin/me", { headers: { Authorization: `Bearer ${session.accessToken}` }, cache: "no-store" }).catch(() => null),
        ]);
        if (!cancelled) {
          setStatus(accountStatus);
          setIsAdmin(Boolean(adminStatus?.ok));
        }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
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
    <main className={styles.accountDashboard} data-image20-dom-page="account-center-v118-ecpay-review-safe">
      <aside className={styles.accountSidebar}>
        <Image20Logo />
        <nav aria-label="帳號中心導覽" className={styles.accountSideNav}>
          {dashboardLinks.map(([href, label]) => <Link key={href} href={href} className={href === "/account" ? styles.accountSideActive : undefined}>{label}</Link>)}
          {isAdmin ? <Link href="/admin">Admin 系統</Link> : null}
        </nav>
        <div className={styles.accountSidebarNote}><b>在安感島，你可以放心做自己。</b><span>個人檔案、身分綁定、Buddies 與客服紀錄會逐步集中到我的島。</span></div>
        <button className={styles.accountSignOut} type="button" onClick={signOut}>登出</button>
      </aside>

      <section className={styles.accountMain}>
        <header className={styles.accountTopbar}>
          <div><span>我的島</span><b>{email || "正在讀取帳號資訊…"}</b></div>
          <div className={styles.accountTopActions}>
            {isAdmin ? <Link href="/admin">進入 Admin 系統</Link> : null}
            <Link href="/account/profile">編輯個人檔案</Link>
            <Link href="/rooms">探索房間</Link>
            <Link href="/schedule">查看排程</Link>
          </div>
        </header>

        <section className={styles.accountHero}>
          <div className={styles.accountHeroBackdrop} aria-hidden="true" />
          <div className={styles.accountHeroCopy}>
            <span className="i20-kicker">Account Center</span>
            <h1 className="i20-serif">歡迎回來，這裡是你的安感島。</h1>
            <p>查看方案狀態、個人檔案、身分綁定、同行額度、安感夥伴與接下來要處理的事情。</p>
          </div>
          <aside className={styles.accountHeroQuote}>
            <b>{isAdmin ? "你目前有管理員權限。" : "不需要急著開始。"}</b>
            <span>{isAdmin ? "Admin 入口只會在通過後端權限檢查後顯示。" : "先確認今天想用什麼節奏前進。"}</span>
          </aside>
        </section>

        <section className={styles.accountProfileGrid}>
          <article className={styles.accountProfileCard}>
            <div className={styles.accountAvatar}>島</div>
            <div><span className="i20-kicker">Profile</span><h2 className="i20-serif">你的安感島帳號</h2><p>{email || "讀取中…"}</p><Link href="/account/profile">編輯個人檔案 →</Link></div>
          </article>
          <article className={styles.accountPlanCard}>
            <span className="i20-kicker">Plan</span><h2 className="i20-serif">{planName}</h2>
            <div className={styles.accountPlanMeta}><span>方案狀態：{loading ? "讀取中" : billingLabel(status)}</span><span>本月剩餘額度：{creditsRemaining}</span>{vipUntil ? <span>VIP 到期日：{vipUntil}</span> : null}</div>
            <Link href="/pricing">管理方案 →</Link>
          </article>
        </section>

        <section className={styles.accountMetricGrid}>
          <article className={styles.accountMetricCard}><span className="i20-kicker">Monthly</span><h3>本月額度使用</h3><b>{creditsUsed} / {allowance}</b><p>{status?.is_vip ? "VIP 方案不受免費額度限制。" : "免費額度用量會依本月進房情況更新。"}</p><Link href="/rooms">前往同行空間 →</Link></article>
          <article className={styles.accountMetricCard}><span className="i20-kicker">Identity</span><h3>身分綁定進度</h3><b>手機 / Email / 人工審核</b><p>手機驗證已可使用，正式身分綁定與人工審核入口已集中在新頁面。</p><Link href="/account/identity/bindings">前往身分綁定 →</Link></article>
          <article className={styles.accountMetricCard}><span className="i20-kicker">Buddies</span><h3>安感夥伴</h3><b>服務 / 時段 / 預約</b><p>Buddies 已分成服務上架、時段管理、預約與爭議紀錄，金流審核期間先不開正式收費。</p><Link href="/buddies">前往安感夥伴 →</Link></article>
        </section>

        <section className={styles.accountContentGrid}>
          <article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Profile</span><h3>公開名片與互動邊界</h3></div><Link href="/account/profile">管理</Link></div><div className={styles.accountPreferenceList}><div><b>顯示名稱與個人代號</b><span>讓房間、Buddies、好友與排程都使用一致身份。</span></div><div><b>公開範圍</b><span>可設定公開、會員可見或好友可見。</span></div></div></article>
          <article className={styles.accountContentCard}><div className={styles.accountContentHead}><div><span className="i20-kicker">Service</span><h3>服務設定與通知</h3></div></div><div className={styles.accountPreferenceList}><div><b>通知偏好</b><span>付款、客服、排程與房間提醒會集中管理。</span></div><div><b>服務紀錄</b><span>帳務、退款與客服處理會保留正式紀錄。</span></div></div></article>
          <aside className={styles.accountSupportStack}>{isAdmin ? <article><span className="i20-kicker">Admin</span><h3>管理員入口</h3><p>此入口只因目前登入帳號通過 ADMIN_EMAILS / ADMIN_USER_IDS 後端驗證而顯示。</p><Link href="/admin">進入 Admin 系統 →</Link></article> : null}<article><span className="i20-kicker">Help</span><h3>需要協助？</h3><p>客服頁會整理表單、官方信箱與安全支援入口。</p><Link href="/contact">聯絡客服 →</Link></article></aside>
        </section>
      </section>
    </main>
  );
}
