"use client";

import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";

type MobileNavProps = {
  pathname: string;
  pageTitle: string;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: Dispatch<SetStateAction<boolean>>;
  resolved: boolean;
  isLoggedIn: boolean;
  currentEmail: string;
  onSignOut: () => Promise<void>;
};

const MOBILE_PRIMARY_ITEMS = [
  { href: "/", label: "首頁", icon: "⌂" },
  { href: "/rooms", label: "同行空間", icon: "▣" },
  { href: "/buddies", label: "安感夥伴", icon: "♥" },
  { href: "/account", label: "我的島", icon: "◎" },
] as const;

const MOBILE_MENU_ITEMS = [
  { href: "/pricing", label: "方案 / 價格" },
  { href: "/contact", label: "客服" },
  { href: "/refund-policy", label: "退款政策" },
] as const;

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav({
  pathname,
  pageTitle,
  mobileMenuOpen,
  setMobileMenuOpen,
  resolved,
  isLoggedIn,
  currentEmail,
  onSignOut,
}: MobileNavProps) {
  return (
    <>
      <header className="cc-mobile-topbar cc-mobile-only" aria-label="Mobile navigation">
        <Link className="cc-mobile-topbar__brand" href="/">
          <span className="cc-brandmark">島</span>
          <span className="cc-mobile-topbar__titlewrap">
            <span className="cc-mobile-topbar__title">安感島</span>
            <span className="cc-mobile-topbar__subtitle">{pageTitle}</span>
          </span>
        </Link>

        <button
          type="button"
          className="cc-mobile-iconbtn"
          aria-label={mobileMenuOpen ? "關閉選單" : "開啟選單"}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((prev) => !prev)}
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
      </header>

      <div
        className={`cc-mobile-menu-backdrop${mobileMenuOpen ? " is-open" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden={!mobileMenuOpen}
      />

      <div className={`cc-mobile-menu-panel${mobileMenuOpen ? " is-open" : ""}`}>
        <div className="cc-mobile-menu-panel__group">
          {MOBILE_MENU_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link key={item.href} href={item.href} className={`cc-mobile-menu-link${active ? " is-active" : ""}`}>
                <span>{item.label}</span>
                <span aria-hidden>→</span>
              </Link>
            );
          })}
        </div>

        <hr className="cc-mobile-menu-panel__divider" />

        {!resolved ? null : isLoggedIn ? (
          <div className="cc-mobile-menu-panel__group">
            <div className="cc-mobile-menu-email">{currentEmail}</div>
            <button className="cc-mobile-menu-button" type="button" onClick={onSignOut}>
              <span>登出</span>
              <span aria-hidden>↗</span>
            </button>
          </div>
        ) : (
          <div className="cc-mobile-menu-panel__group">
            <Link href="/auth/login" className="cc-mobile-menu-link">
              <span>登入</span>
              <span aria-hidden>→</span>
            </Link>
            <Link href="/auth/signup" className="cc-mobile-menu-link">
              <span>註冊</span>
              <span aria-hidden>→</span>
            </Link>
          </div>
        )}
      </div>

      <nav className="cc-mobile-bottomnav cc-mobile-only" aria-label="Mobile primary navigation">
        {MOBILE_PRIMARY_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link key={item.href} href={item.href} className={`cc-mobile-bottomnav__item${active ? " is-active" : ""}`}>
              <span className="cc-mobile-bottomnav__icon" aria-hidden>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
