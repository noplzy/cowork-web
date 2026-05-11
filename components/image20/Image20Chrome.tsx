"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { clearAccountStatusCache } from "@/lib/accountStatusClient";
import { getClientSessionSnapshot, invalidateClientSessionSnapshotCache } from "@/lib/clientAuth";

const primaryNav = [
  ["/", "首頁"],
  ["/rooms", "同行空間"],
  ["/buddies", "安感夥伴"],
  ["/pricing", "方案 / 價格"],
  ["/contact", "客服"],
] as const;

const appNav = [
  ["/account", "我的島"],
  ["/account/identity", "身份驗證"],
  ["/friends", "好友"],
  ["/schedule", "排程"],
  ["/rooms", "同行空間"],
] as const;

const heroByPath = [
  { match: (path: string) => path.startsWith("/rooms"), image: "/site-assets/image20/rooms/rooms-browsing-lounge-evening.png", lead: "在安感島，找一段現在可以一起在場的時間；也可以先排程，等你準備好再開始。" },
  { match: (path: string) => path.startsWith("/buddies"), image: "/site-assets/image20/hero/brand-hero-evening-shared-presence.png", lead: "把陪伴做成有邊界、可預約、低壓力的服務，而不是交友或直播。" },
  { match: (path: string) => path.startsWith("/pricing"), image: "/site-assets/image20/hero/brand-hero-evening-shared-presence.png", lead: "先理解規則，再選擇適合自己的同行方式；價格透明，不用猜。" },
  { match: (path: string) => path.startsWith("/account"), image: "/site-assets/image20/auth/auth-evening-window-return.png", lead: "回到自己的島，查看方案、排程、安全設定與下一次準備開始的同行。" },
  { match: (path: string) => path.startsWith("/friends"), image: "/site-assets/image20/hero/brand-hero-evening-shared-presence.png", lead: "把熟悉的人留在舒服的距離，該靠近時能一起，該安靜時也不打擾。" },
  { match: (path: string) => path.startsWith("/schedule"), image: "/site-assets/image20/rooms/rooms-browsing-lounge-evening.png", lead: "把想開始的事先放進一段溫和的時間裡，到了再一起進房。" },
  { match: (path: string) => path.startsWith("/u/"), image: "/site-assets/image20/hero/brand-hero-evening-shared-presence.png", lead: "公開頁是一張安靜可信任的名片，不是交友頁，也不是表演舞台。" },
  { match: () => true, image: "/site-assets/image20/hero/brand-hero-evening-shared-presence.png", lead: "安靜、低壓力、可信任的數位在場空間。" },
] as const;

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Image20Logo() {
  return (
    <Link href="/" className="i20-logo" aria-label="回到安感島首頁">
      <span className="i20-logo-mark" aria-hidden="true" />
      <strong>安感島</strong>
      <span>Calm&amp;Co</span>
    </Link>
  );
}

export function Image20TopNav({ dark = false, email: propEmail }: { dark?: boolean; email?: string }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [email, setEmail] = useState(propEmail ?? "");
  const [resolved, setResolved] = useState(Boolean(propEmail));

  useEffect(() => {
    if (propEmail) {
      setEmail(propEmail);
      setResolved(true);
      return;
    }

    let cancelled = false;

    getClientSessionSnapshot()
      .then((session) => {
        if (cancelled) return;
        setEmail(session?.email ?? "");
        setResolved(true);
      })
      .catch(() => setResolved(true));

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? "");
      setResolved(true);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [propEmail]);

  async function signOut() {
    await supabase.auth.signOut();
    invalidateClientSessionSnapshotCache();
    clearAccountStatusCache();
    setEmail("");
    router.replace("/auth/login");
  }

  return (
    <header className={`i20-top${dark ? " is-dark" : ""}`} data-image20-dom-nav="buddies-marketplace-v8">
      <Image20Logo />

      <nav className="i20-links" aria-label="主要導覽">
        {primaryNav.map(([href, label]) => (
          <Link key={href} href={href} className={isActivePath(pathname, href) ? "is-active" : ""}>
            {label}
          </Link>
        ))}
      </nav>

      <div className="i20-actions" aria-label="帳號操作">
        {resolved && email ? (
          <>
            <Link href="/account" className="i20-nav-pill i20-email-pill" title={email}>{email}</Link>
            <Link href="/account" className="i20-nav-pill i20-nav-primary">我的島</Link>
            <button type="button" className="i20-nav-link-button" onClick={signOut}>登出</button>
          </>
        ) : (
          <>
            <Link href="/auth/login" className="i20-nav-link">登入</Link>
            <Link href="/auth/signup" className="i20-nav-pill i20-nav-primary">免費註冊</Link>
          </>
        )}
      </div>
    </header>
  );
}

export function Image20SidebarShell({ title, children, email, lead }: { title: string; children: ReactNode; email?: string; lead?: string }) {
  const pathname = usePathname() || "/";
  const hero = useMemo(() => heroByPath.find((item) => item.match(pathname)) ?? heroByPath[heroByPath.length - 1], [pathname]);
  const heroStyle = { "--i20-hero-bg": `url(${hero.image})` } as CSSProperties;

  return (
    <main className="i20-root i20-shell-root" data-image20-dom-shell="v8-buddies-style">
      <section className="i20-shell-hero" style={heroStyle}>
        <div className="i20-shell-hero-media" aria-hidden="true" />
        <Image20TopNav dark email={email} />
        <div className="i20-shell-hero-copy">
          <span className="i20-kicker">Calm&amp;Co / 安感島</span>
          <h1 className="i20-serif">{title}</h1>
          <p>{lead ?? hero.lead}</p>
        </div>
      </section>

      <section className="i20-shell-body">
        <div className="i20-shell-subnav" aria-label="功能捷徑">
          {appNav.map(([href, label]) => (
            <Link key={href} href={href} className={isActivePath(pathname, href) ? "is-active" : ""}>
              {label}
            </Link>
          ))}
        </div>
        <div className="i20-shell-content">{children}</div>
      </section>

      <Image20Footer />
    </main>
  );
}

export function Image20Footer() {
  return (
    <footer className="i20-footer" data-image20-dom-footer="buddies-marketplace-v8">
      <div className="i20-footer-brand">
        <Image20Logo />
        <p>我們在乎每一次相遇。若有任何疑問，歡迎聯絡客服。</p>
      </div>

      <nav className="i20-footer-links" aria-label="頁尾導覽">
        <Link href="/pricing">方案與價格</Link>
        <Link href="/contact">聯絡我們</Link>
        <Link href="/refund-policy">退款政策</Link>
        <Link href="/terms">平台規則</Link>
        <Link href="/privacy">隱私權</Link>
        <Link href="/service-delivery">服務交付</Link>
      </nav>
    </footer>
  );
}
