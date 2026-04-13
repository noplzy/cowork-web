"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { clearAccountStatusCache } from "@/lib/accountStatusClient";
import { getClientSessionSnapshot, invalidateClientSessionSnapshotCache } from "@/lib/clientAuth";
import { DesktopHeader } from "@/components/DesktopHeader";
import { MobileNav } from "@/components/MobileNav";

type Props = {
  email?: string;
  onSignOut?: () => Promise<void> | void;
  sharedInstance?: boolean;
};

export const SharedTopNavContext = createContext(false);

const HEADER_VERSION = "2026-04-13-release-layout-fixes-v1";

let lastResolvedEmail = "";
let hasResolvedAtLeastOnce = false;

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

export function TopNav({ email, onSignOut, sharedInstance = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sharedTopNavActive = useContext(SharedTopNavContext);

  if (sharedTopNavActive && !sharedInstance) {
    return null;
  }

  const [sessionEmail, setSessionEmail] = useState(() => email ?? lastResolvedEmail);
  const [resolved, setResolved] = useState(() => Boolean(email) || hasResolvedAtLeastOnce);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (email) {
      lastResolvedEmail = email;
      hasResolvedAtLeastOnce = true;
      setSessionEmail(email);
      setResolved(true);
      return;
    }

    (async () => {
      const session = await getClientSessionSnapshot().catch(() => null);
      if (cancelled) return;
      const nextEmail = session?.email ?? "";
      lastResolvedEmail = nextEmail;
      hasResolvedAtLeastOnce = true;
      setSessionEmail(nextEmail);
      setResolved(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [email]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextEmail = session?.user?.email ?? "";
      lastResolvedEmail = nextEmail;
      hasResolvedAtLeastOnce = true;
      setSessionEmail(nextEmail);
      setResolved(true);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

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
    lastResolvedEmail = "";
    hasResolvedAtLeastOnce = true;
    setSessionEmail("");
    setResolved(true);
    router.replace("/auth/login");
  }

  return (
    <>
      <DesktopHeader
        pathname={pathname}
        headerVersion={HEADER_VERSION}
        resolved={resolved}
        isLoggedIn={isLoggedIn}
        currentEmail={currentEmail}
        onSignOut={handleSignOut}
      />
      <MobileNav
        pathname={pathname}
        pageTitle={pageTitle}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        resolved={resolved}
        isLoggedIn={isLoggedIn}
        currentEmail={currentEmail}
        onSignOut={handleSignOut}
      />
    </>
  );
}
