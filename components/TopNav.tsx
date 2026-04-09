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

const NAV_ITEMS = [
  { href: "/", label: "首頁" },
  { href: "/rooms", label: "同行空間" },
  { href: "/buddies", label: "安感夥伴" },
  { href: "/pricing", label: "方案 / 價格" },
  { href: "/contact", label: "客服" },
];

export function TopNav({ email, onSignOut }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [sessionEmail, setSessionEmail] = useState("");
  const [resolved, setResolved] = useState(Boolean(email));

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

  const currentEmail = useMemo(() => email || sessionEmail, [email, sessionEmail]);
  const isLoggedIn = Boolean(currentEmail);

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
    <header className="cc-navshell">
      <div className="cc-navshell__glow" />
      <div className="cc-nav">
        <div className="cc-row cc-nav__left" style={{ flexWrap: "wrap", alignItems: "center" }}>
          <Link className="cc-navbrand" href="/">
            <span className="cc-brandmark">島</span>
            <span className="cc-navbrandtext">
              <span className="cc-brandtitle">安感島</span>
              <span className="cc-brandsubtitle">低壓力陪伴與同行平台</span>
            </span>
          </Link>

          <nav className="cc-navlinks" aria-label="Primary">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  className={`cc-navlink${active ? " is-active" : ""}`}
                  href={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="cc-navmeta">
          {!resolved ? null : isLoggedIn ? (
            <>
              <span className="cc-navemail">{currentEmail}</span>
              <Link className="cc-btn" href="/account">
                我的帳號
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
  );
}
