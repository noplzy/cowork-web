"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
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

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-md">
          <span className="cc-kicker">Warm Quiet Digital Sanctuary</span>
          <p className="cc-eyebrow">安感島｜不只做共工，而是承接不同低壓力同行場景的品牌</p>
          <h1 className="cc-h2" style={{ fontSize: "clamp(2rem, 4vw, 3.8rem)" }}>
            先把同行空間做穩，再慢慢把這座島長出來。
          </h1>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.9 }}>
            安感島不是把一堆功能堆在首頁上，而是先把真正常用的入口做清楚。
            現在最成熟的主線是同行空間：你可以直接進房，也可以先安排下一段想一起待著的時間。
          </p>

          <div className="cc-action-row">
            <Link href="/rooms" className="cc-btn-primary">
              {isLoggedIn ? "前往同行空間" : "開始使用"}
            </Link>
            <Link href="/buddies" className="cc-btn">了解安感夥伴</Link>
            <Link href={isLoggedIn ? "/account" : "/pricing"} className="cc-btn-link">
              {isLoggedIn ? "查看我的帳號 →" : "先看方案規則 →"}
            </Link>
          </div>
        </article>

        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">現在先做好的事情</p>
            <h2 className="cc-h2">不要把入口做成雜物間。</h2>
          </div>

          <div className="cc-note cc-stack-sm">
            <div><strong>同行空間：</strong> 即時加入與排程功能都放在同一條主線裡。</div>
            <div><strong>安感夥伴：</strong> 保留未來的陪伴與專業服務擴張空間。</div>
            <div><strong>方案與客服：</strong> 對外公開資訊維持清楚、可查、可申訴。</div>
          </div>

          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            我們刻意不把好友、排程、個人檔案全部抬到首頁主導航，
            因為那會讓品牌看起來像功能堆疊，而不是一個主線清楚的產品。
          </p>
        </article>
      </section>

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-sm">
          <p className="cc-card-kicker">目前主線</p>
          <h2 className="cc-h2">同行空間</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            不管你是要專注共工、生活陪伴，還是先安排下一次一起待著的時段，
            現在都從同行空間開始。
          </p>
          <div className="cc-action-row">
            <Link href="/rooms" className="cc-btn-primary">進入同行空間</Link>
          </div>
        </article>

        <article className="cc-card cc-stack-sm">
          <p className="cc-card-kicker">公開資訊</p>
          <h2 className="cc-h2">先把規則說清楚，再讓人決定要不要留下。</h2>
          <div className="cc-action-row">
            <Link href="/pricing" className="cc-btn">方案 / 價格</Link>
            <Link href="/contact" className="cc-btn">客服</Link>
            <Link href="/refund-policy" className="cc-btn">退款政策</Link>
          </div>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
