"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { getClientSessionSnapshot } from "@/lib/clientAuth";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await getClientSessionSnapshot().catch(() => null);
      if (!cancelled) {
        setIsLoggedIn(Boolean(session));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="cc-container">
      <TopNav />

      <section className="cc-hero">
        <div className="cc-card cc-hero-main">
          <span className="cc-kicker">Warm Quiet Digital Sanctuary</span>
          <p className="cc-eyebrow">安感島｜安靜、高質感、低壓力的數位空間</p>
          <h1 className="cc-h1">把登入流程做正常，人才願意留下來。</h1>
          <p className="cc-lead">
            你可以用 Email / 密碼登入，也可以直接使用 Google 快速進入。
            已登入的使用者不應再被導回註冊頁，而應直接回到 Rooms。
          </p>

          <div className="cc-action-row">
            {isLoggedIn ? (
              <>
                <Link href="/rooms" className="cc-btn-primary">回到 Rooms</Link>
                <Link href="/account" className="cc-btn">查看方案 / 額度</Link>
              </>
            ) : (
              <>
                <Link href="/auth/signup" className="cc-btn-primary">建立帳號</Link>
                <Link href="/auth/login" className="cc-btn">登入</Link>
              </>
            )}
          </div>

          <div className="cc-grid-metrics cc-section">
            <div className="cc-metric">
              <span className="cc-metric-label">Google 登入</span>
              <div className="cc-metric-value" style={{ fontSize: "1.1rem" }}>固定可見</div>
            </div>
            <div className="cc-metric">
              <span className="cc-metric-label">登入後</span>
              <div className="cc-metric-value" style={{ fontSize: "1.1rem" }}>直接回 Rooms</div>
            </div>
            <div className="cc-metric">
              <span className="cc-metric-label">未登入</span>
              <div className="cc-metric-value" style={{ fontSize: "1.1rem" }}>登入 / 註冊分開</div>
            </div>
          </div>
        </div>

        <div className="cc-hero-side">
          <div className="cc-card cc-feature-card cc-stack-md">
            <div className="cc-card-row">
              <div>
                <p className="cc-card-kicker">正常 auth flow</p>
                <h2 className="cc-h2">不要再讓已登入的人回去註冊</h2>
              </div>
            </div>
            <ul className="cc-bullets">
              <li>登入頁固定提供 Google 與 Email / Password。</li>
              <li>註冊頁固定提供 Google 與 Email 註冊。</li>
              <li>已登入者再進 auth 頁時，直接導回 Rooms。</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
