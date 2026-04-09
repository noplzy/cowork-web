"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { getClientSessionSnapshot } from "@/lib/clientAuth";

const quickCards = [
  {
    title: "現在進房",
    body: "想立刻找人一起開始，就先進同行空間。",
    href: "/rooms",
    cta: "前往同行空間",
  },
  {
    title: "找安感夥伴",
    body: "想找更明確的陪跑、陪伴或預約服務，就去安感夥伴。",
    href: "/buddies",
    cta: "查看安感夥伴",
  },
  {
    title: "先看規則",
    body: "想先知道免費額度、VIP 與客服規則，就先看方案與價格。",
    href: "/pricing",
    cta: "查看方案 / 價格",
  },
];

const useCases = [
  "專注共工：一起開工、一起收尾。",
  "生活陪伴：做家務、整理、日常陪伴。",
  "主題交流：有一個清楚主題，一起聊完。",
];

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await getClientSessionSnapshot().catch(() => null);
      if (!cancelled) setIsLoggedIn(Boolean(session));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="cc-container">
      <TopNav />

      <section className="cc-hero">
        <article className="cc-card cc-hero-main cc-stack-md">
          <span className="cc-kicker">Calm&Co / 安感島</span>
          <p className="cc-eyebrow">低壓力陪伴與同行平台</p>
          <h1 className="cc-h1" style={{ maxWidth: "9ch" }}>
            不想一個人撐著時，先來這裡。
          </h1>
          <p className="cc-lead" style={{ maxWidth: "38ch" }}>
            安感島不是要你先讀很多規則，而是先幫你找到下一步：現在進房、找安感夥伴，或先看方案。
          </p>

          <div className="cc-action-row">
            <Link href="/rooms" className="cc-btn-primary">
              {isLoggedIn ? "進入同行空間" : "開始使用"}
            </Link>
            <Link href="/buddies" className="cc-btn">
              找安感夥伴
            </Link>
          </div>

          <div className="cc-page-meta">
            <span className="cc-pill-warning">免費每月 4 場</span>
            <span className="cc-pill-soft">可即時進房</span>
            <span className="cc-pill-soft">可排程</span>
            <span className="cc-pill-soft">有公開規則與客服</span>
          </div>
        </article>

        <aside className="cc-hero-side">
          <div className="cc-card cc-stack-md">
            <div>
              <p className="cc-card-kicker">今天你可以做的事</p>
              <h2 className="cc-h2">先選一條路，不要一次理解整座島。</h2>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {quickCards.map((card) => (
                <article key={card.title} className="cc-card cc-card-soft cc-stack-sm" style={{ padding: 16 }}>
                  <div className="cc-h3">{card.title}</div>
                  <div className="cc-muted" style={{ lineHeight: 1.7 }}>
                    {card.body}
                  </div>
                  <Link href={card.href} className="cc-btn-link">
                    {card.cta} →
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </aside>
      </section>

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">適合的場景</p>
            <h2 className="cc-h2">不只共工，但每一種場景都要夠清楚。</h2>
          </div>
          <ul className="cc-bullets">
            {useCases.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">使用原則</p>
            <h2 className="cc-h2">先把好上手做出來，再慢慢加深。</h2>
          </div>
          <div className="cc-note cc-stack-sm">
            <div>首頁先告訴你能做什麼，不先塞滿功能說明。</div>
            <div>Rooms 先承接即時與排程，Buddies 承接預約與陪伴服務。</div>
            <div>規則、付款、客服都有公開頁，但不該壓在第一屏。</div>
          </div>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
