"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  ["/rooms", "Rooms"],
] as const;

export function Image20Logo() {
  return (
    <Link href="/" className="i20-logo">
      <span className="i20-logo-mark" aria-hidden="true" />
      <strong>安感島</strong>
      <span>Calm&amp;Co</span>
    </Link>
  );
}

export function Image20TopNav({ dark = false, email: propEmail }: { dark?: boolean; email?: string }) {
  const pathname = usePathname();
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
    <header className={`i20-top${dark ? " is-dark" : ""}`} data-image20-dom-nav="top-v7">
      <Image20Logo />
      <nav className="i20-links" aria-label="主要導覽">
        {primaryNav.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className={pathname === href || (href !== "/" && pathname.startsWith(href)) ? "is-active" : ""}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="i20-actions">
        {resolved && email ? (
          <>
            <Link href="/account" className="i20-nav-pill">{email}</Link>
            <Link href="/account" className="i20-nav-pill i20-nav-primary">我的島</Link>
            <button type="button" className="i20-nav-pill" onClick={signOut}>登出</button>
          </>
        ) : (
          <>
            <Link href="/auth/login" className="i20-nav-pill">登入</Link>
            <Link href="/auth/signup" className="i20-nav-pill i20-nav-primary">加入</Link>
          </>
        )}
      </div>
    </header>
  );
}

export function Image20SidebarShell({ title, children, email }: { title: string; children: React.ReactNode; email?: string }) {
  const pathname = usePathname();
  return (
    <main className="i20-root i20-shell-root" data-image20-dom-shell="unified-v7">
      <section className="i20-shell-hero">
        <div className="i20-shell-hero-media" aria-hidden="true" />
        <Image20TopNav dark email={email} />
        <div className="i20-shell-hero-copy">
          <span className="i20-kicker">Calm&amp;Co / 安感島</span>
          <h1 className="i20-serif">{title}</h1>
          <p>整站維持與首頁一致的安靜、低壓力、霧面玻璃感與夜景氛圍，不再讓切頁像換網站。</p>
        </div>
      </section>

      <section className="i20-shell-body">
        <div className="i20-shell-subnav" aria-label="功能捷徑">
          {appNav.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={pathname === href || pathname.startsWith(`${href}/`) ? "is-active" : ""}
            >
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
    <footer className="i20-footer">
      <div>
        <b>安感島 Calm&amp;Co</b>
        <br />
        <small>低壓力同行、安靜陪伴與可信任的數位在場空間</small>
      </div>
      <div className="i20-actions-row">
        <Link href="/terms">服務條款</Link>
        <Link href="/privacy">隱私權</Link>
        <Link href="/refund-policy">退款政策</Link>
        <Link href="/service-delivery">服務交付</Link>
        <Link href="/contact">客服</Link>
      </div>
    </footer>
  );
}
