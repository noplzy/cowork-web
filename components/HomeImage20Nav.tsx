"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { clearAccountStatusCache } from "@/lib/accountStatusClient";
import { getClientSessionSnapshot, invalidateClientSessionSnapshotCache } from "@/lib/clientAuth";

const navItems = [
  { href: "/rooms", label: "探索房間" },
  { href: "/buddies", label: "找安感夥伴" },
  { href: "/schedule", label: "主題活動" },
  { href: "/contact", label: "關於我們" },
];

export function HomeImage20Nav() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [resolved, setResolved] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await getClientSessionSnapshot().catch(() => null);
      if (cancelled) return;
      setEmail(session?.email ?? "");
      setResolved(true);
    })();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? "");
      setResolved(true);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    invalidateClientSessionSnapshotCache();
    clearAccountStatusCache();
    setEmail("");
    setOpen(false);
    router.replace("/");
  }

  const loggedIn = Boolean(email);

  return (
    <header className="image20-nav" data-image20-nav="homepage-v2">
      <Link href="/" className="image20-nav__brand" aria-label="回到安感島首頁">
        <span className="image20-nav__mark" aria-hidden="true">
          <span />
        </span>
        <span className="image20-nav__brandtext">
          <strong>安感島</strong>
          <em>Calm&amp;Co</em>
        </span>
      </Link>

      <nav className="image20-nav__links" aria-label="主要導覽">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="image20-nav__actions">
        {resolved && loggedIn ? (
          <>
            <Link href="/account" className="image20-nav__login image20-nav__email">
              {email}
            </Link>
            <button type="button" className="image20-nav__cta image20-nav__ghost" onClick={signOut}>
              登出
            </button>
          </>
        ) : (
          <>
            <Link href="/auth/login" className="image20-nav__login">
              登入
            </Link>
            <Link href="/auth/signup" className="image20-nav__cta">
              免費註冊
            </Link>
          </>
        )}
        <button
          type="button"
          className="image20-nav__menu"
          aria-label="開啟選單"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          ☰
        </button>
      </div>

      {open ? (
        <div className="image20-nav__drawer">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
          {loggedIn ? (
            <>
              <Link href="/account" onClick={() => setOpen(false)}>我的島</Link>
              <button type="button" onClick={signOut}>登出</button>
            </>
          ) : (
            <>
              <Link href="/auth/login" onClick={() => setOpen(false)}>登入</Link>
              <Link href="/auth/signup" onClick={() => setOpen(false)}>免費註冊</Link>
            </>
          )}
        </div>
      ) : null}
    </header>
  );
}
