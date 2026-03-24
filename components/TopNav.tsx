"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { clearAccountStatusCache } from "@/lib/accountStatusClient";
import { getClientSessionSnapshot, invalidateClientSessionSnapshotCache } from "@/lib/clientAuth";

type Props = {
  email?: string;
  onSignOut?: () => Promise<void> | void;
};

export function TopNav({ email, onSignOut }: Props) {
  const router = useRouter();
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
      <div className="cc-nav">
        <div className="cc-row" style={{ flexWrap: "wrap", alignItems: "center" }}>
          <Link className="cc-navbrand" href="/">
            <span className="cc-brandmark">島</span>
            <span>
              <span className="cc-brandtitle">安感島</span>
              <span className="cc-brandsubtitle">給獨自撐著的你，一個安靜靠岸的地方</span>
            </span>
          </Link>

          <nav className="cc-navlinks" aria-label="Primary">
            <Link className="cc-navlink" href="/">首頁</Link>
            <Link className="cc-navlink" href="/rooms">Rooms</Link>
            {isLoggedIn ? <Link className="cc-navlink" href="/account">方案 / 額度</Link> : null}
          </nav>
        </div>

        <div className="cc-navmeta">
          {!resolved ? null : isLoggedIn ? (
            <>
              <span className="cc-pill-soft">{currentEmail}</span>
              <button className="cc-btn" onClick={handleSignOut} type="button">
                登出
              </button>
            </>
          ) : (
            <>
              <Link className="cc-btn-link" href="/auth/login">登入</Link>
              <Link className="cc-btn" href="/auth/signup">註冊</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
