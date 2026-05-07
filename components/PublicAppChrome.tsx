"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SharedTopNavContext } from "@/components/TopNav";
import { ExactAiOrb } from "@/components/Image20ExactFrame";

export function PublicAppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideAi = pathname?.startsWith("/auth") || pathname === "/ai/companion";

  return (
    <SharedTopNavContext.Provider value={false}>
      {children}
      {!hideAi ? <ExactAiOrb /> : null}
    </SharedTopNavContext.Provider>
  );
}
