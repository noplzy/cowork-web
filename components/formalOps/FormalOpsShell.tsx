"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Image20Logo } from "@/components/image20/Image20Chrome";
import styles from "@/components/image20/Image20Auxiliary.module.css";

type NavItem = readonly [href: string, label: string];

export function FormalOpsShell({
  activeHref,
  navItems,
  eyebrow,
  title,
  description,
  quoteTitle,
  quoteBody,
  topActions,
  children,
  dataPage,
}: {
  activeHref: string;
  navItems: readonly NavItem[];
  eyebrow: string;
  title: string;
  description: string;
  quoteTitle?: string;
  quoteBody?: string;
  topActions?: ReactNode;
  children: ReactNode;
  dataPage: string;
}) {
  return (
    <main className={styles.accountDashboard} data-image20-dom-page={dataPage}>
      <aside className={styles.accountSidebar}>
        <Image20Logo />
        <nav aria-label="正式營運導覽" className={styles.accountSideNav}>
          {navItems.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={href === activeHref ? styles.accountSideActive : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className={styles.accountSidebarNote}>
          <b>安感島正式營運</b>
          <span>
            個人檔案、身分綁定、客服、帳務、通知、房間、權限與 Buddies 都需要可追蹤紀錄。
          </span>
        </div>
      </aside>
      <section className={styles.accountMain}>
        <header className={styles.accountTopbar}>
          <div>
            <span>{eyebrow}</span>
            <b>{title}</b>
          </div>
          {topActions ? (
            <div className={styles.accountTopActions}>{topActions}</div>
          ) : null}
        </header>
        <section className={styles.accountHero}>
          <div className={styles.accountHeroBackdrop} aria-hidden="true" />
          <div className={styles.accountHeroCopy}>
            <span className="i20-kicker">{eyebrow}</span>
            <h1 className="i20-serif">{title}</h1>
            <p>{description}</p>
          </div>
          {quoteTitle || quoteBody ? (
            <aside className={styles.accountHeroQuote}>
              {quoteTitle ? <b>{quoteTitle}</b> : null}
              {quoteBody ? <span>{quoteBody}</span> : null}
            </aside>
          ) : null}
        </section>
        {children}
      </section>
    </main>
  );
}

export const accountOpsNav = [
  ["/account", "我的中心"],
  ["/account/profile", "個人檔案"],
  ["/account/identity", "手機驗證"],
  ["/account/identity/bindings", "身分綁定"],
  ["/account/notifications", "通知中心"],
  ["/account/notification-preferences", "通知偏好"],
  ["/account/rooms", "Rooms 歷史"],
  ["/account/billing", "帳務紀錄"],
  ["/account/subscriptions", "訂閱管理"],
  ["/account/support", "客服紀錄"],
  ["/account/refunds", "退款申請"],
  ["/account/security", "安全與封鎖"],
  ["/buddies", "安感夥伴"],
  ["/contact", "公開客服入口"],
] as const;

export const adminOpsNav = [
  ["/admin", "營運總覽"],
  ["/admin/roles", "權限管理"],
  ["/admin/action-center", "營運工作台"],
  ["/admin/trust", "信任審核"],
  ["/admin/notifications", "通知 Outbox"],
  ["/admin/notifications/templates", "通知模板"],
  ["/admin/users", "使用者 360"],
  ["/admin/rooms", "房間 360"],
  ["/admin/rooms/reconciliation", "房間對帳"],
  ["/admin/support", "客服單"],
  ["/admin/safety", "安全檢舉"],
  ["/admin/moderation", "治理案件"],
  ["/admin/refunds", "退款審核"],
  ["/admin/billing", "付款帳務"],
  ["/admin/billing/automation", "自動化任務"],
  ["/buddies", "Buddies 前台"],
  ["/account", "回我的中心"],
] as const;
