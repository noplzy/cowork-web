"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SharedTopNavContext, TopNav } from "@/components/TopNav";

function shouldUseSharedTopNav(pathname: string) {
  if (!pathname) return false;

  if (pathname.startsWith("/auth")) return false;
  if (pathname.startsWith("/rooms/")) return false;

  if (pathname === "/") return true;
  if (pathname === "/rooms") return true;
  if (pathname === "/buddies") return true;
  if (pathname.startsWith("/buddies/")) return true;
  if (pathname === "/pricing") return true;
  if (pathname === "/contact") return true;
  if (pathname === "/refund-policy") return true;
  if (pathname === "/privacy") return true;
  if (pathname === "/terms") return true;
  if (pathname === "/service-delivery") return true;
  if (pathname === "/about") return true;
  if (pathname === "/schedule") return true;
  if (pathname === "/account") return true;
  if (pathname.startsWith("/account/")) return true;
  if (pathname === "/friends") return true;
  if (pathname.startsWith("/u/")) return true;
  if (pathname === "/checkout/result") return true;

  return false;
}

export function PublicAppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const useSharedTopNav = shouldUseSharedTopNav(pathname);

  return (
    <SharedTopNavContext.Provider value={useSharedTopNav}>
      {useSharedTopNav ? (
        <div className="cc-container">
          <TopNav sharedInstance />
        </div>
      ) : null}
      {children}
    </SharedTopNavContext.Provider>
  );
}
