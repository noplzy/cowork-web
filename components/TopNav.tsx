"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { clearAccountStatusCache } from "@/lib/accountStatusClient";
import { getClientSessionSnapshot, invalidateClientSessionSnapshotCache } from "@/lib/clientAuth";

type Props = {
  email?: string;
  onSignOut?: () => Promise<void> | void;
};

const DESKTOP_NAV_ITEMS = [
  { href: "/", label: "首頁" },
  { href: "/rooms", label: "同行空間" },
  { href: "/buddies", label: "安感夥伴" },
  { href: "/pricing", label: "方案 / 價格" },
  { href: "/contact", label: "客服" },
] as const;

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

function getMobilePageTitle(pathname: string) {
  if (pathname === "/") return "首頁";
  if (pathname.startsWith("/rooms")) return "同行空間";
  if (pathname.startsWith("/buddies")) return "安感夥伴";
  if (pathname.startsWith("/pricing")) return "方案 / 價格";
  if (pathname.startsWith("/contact")) return "客服";
  if (pathname.startsWith("/refund-policy")) return "退款政策";
  if (pathname.startsWith("/account")) return "我的島";
  return "安感島";
}

export function TopNav({ email, onSignOut }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [sessionEmail, setSessionEmail] = useState("");
  const [resolved, setResolved] = useState(Boolean(email));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (email) {
      setSessionEmail(email);
      setResolved(true);
      return;
    }

    (async () => {
      const session = await getClientSessionSnapshot().catch(() => null);
      if (cancelled) return;
      setSessionEmail(session?.email ?? "");
      setResolved(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [email]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const currentEmail = useMemo(() => email || sessionEmail, [email, sessionEmail]);
  const isLoggedIn = Boolean(currentEmail);
  const pageTitle = useMemo(() => getMobilePageTitle(pathname), [pathname]);

  async function handleSignOut() {
    if (onSignOut) {
      await onSignOut();
      return;
    }

    await supabase.auth.signOut();
    invalidateClientSessionSnapshotCache();
    clearAccountStatusCache();
    router.replace("/auth/login");
  }

  return (
    <>
      <header className="cc-navshell cc-desktop-only" aria-label="Desktop navigation">
        <div className="cc-navshell__glow" />
        <div className="cc-nav cc-nav--desktop">
          <div className="cc-nav__brandrail">
            <Link className="cc-navbrand" href="/">
              <span className="cc-brandmark">島</span>
              <span className="cc-navbrandtext">
                <span className="cc-brandtitle">安感島</span>
                <span className="cc-brandsubtitle">不用一個人撐著，也能開始</span>
              </span>
            </Link>
          </div>

          <nav className="cc-navlinks" aria-label="Primary">
            {DESKTOP_NAV_ITEMS.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link key={item.href} className={`cc-navlink${active ? " is-active" : ""}`} href={item.href}>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="cc-navmeta cc-navmeta--desktop">
            {!resolved ? null : isLoggedIn ? (
              <>
                <span className="cc-navemail" title={currentEmail}>
                  {currentEmail}
                </span>
                <Link className="cc-btn" href="/account">
                  我的島
                </Link>
                <button className="cc-btn cc-navsignout" onClick={handleSignOut} type="button">
                  登出
                </button>
              </>
            ) : (
              <>
                <Link className="cc-btn-link" href="/auth/login">
                  登入
                </Link>
                <Link className="cc-btn" href="/auth/signup">
                  註冊
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

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
            <button className="cc-mobile-menu-button" type="button" onClick={handleSignOut}>
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
