"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { getClientSessionSnapshot } from "@/lib/clientAuth";

const quickCards = [
  {
    title: "現在就進房",
    body: "想立刻開始，就先進同行空間，找一段現在能進去的時間。",
    href: "/rooms",
    cta: "進入同行空間",
    tone: "var(--cc-scene-focus)",
  },
  {
    title: "找安感夥伴",
    body: "想找更明確的陪跑、陪伴或可預約服務，就去安感夥伴。",
    href: "/buddies",
    cta: "查看安感夥伴",
    tone: "var(--cc-scene-life)",
  },
  {
    title: "先看方案",
    body: "想先知道免費額度、VIP 與客服規則，再決定也可以。",
    href: "/pricing",
    cta: "查看方案 / 價格",
    tone: "var(--cc-scene-share)",
  },
];

const sceneCards = [
  {
    title: "專注同行",
    body: "讀書、工作、寫作、整理資料。有人一起，開始比較不難。",
    pills: ["25 / 50 分鐘", "安靜同行"],
    tone: "var(--cc-scene-focus)",
  },
  {
    title: "生活陪伴",
    body: "做家務、收納、煮飯、陪自己過完一段普通日常。",
    pills: ["低壓力", "輕聊天"],
    tone: "var(--cc-scene-life)",
  },
  {
    title: "主題分享",
    body: "有一個明確主題，大家一起聊完，不需要把自己丟進吵雜群組。",
    pills: ["分享房", "開放交流"],
    tone: "var(--cc-scene-share)",
  },
];

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
        <article className="cc-card cc-hero-main cc-stack-md">
          <span className="cc-kicker">Calm&Co / 安感島</span>
          <p className="cc-eyebrow">低壓力陪伴與同行平台</p>
          <h1 className="cc-h1" style={{ maxWidth: "8ch" }}>
            今天不用一個人開始。
          </h1>
          <p className="cc-lead" style={{ maxWidth: "38ch" }}>
            想立刻找人一起做事、一起待著，或想找一位更明確的陪伴夥伴，都可以從這裡開始。
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

          <div className="cc-grid-3" style={{ gap: 12, marginTop: 8 }}>
            {sceneCards.map((card) => (
              <article
                key={card.title}
                className="cc-card cc-card-soft cc-stack-sm"
                style={{
                  padding: 16,
                  borderColor: "rgba(89,88,82,0.10)",
                  background: `linear-gradient(180deg, rgba(255,255,255,0.34), ${card.tone})`,
                }}
              >
                <div className="cc-h3">{card.title}</div>
                <div className="cc-muted" style={{ lineHeight: 1.75 }}>
                  {card.body}
                </div>
                <div className="cc-action-row" style={{ marginTop: 0 }}>
                  {card.pills.map((pill) => (
                    <span key={pill} className="cc-pill-soft">
                      {pill}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </article>

        <aside className="cc-hero-side">
          <div className="cc-card cc-stack-md">
            <div>
              <p className="cc-card-kicker">現在就能做的事</p>
              <h2 className="cc-h2">先選一條路，不用一次理解整座島。</h2>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {quickCards.map((card) => (
                <article
                  key={card.title}
                  className="cc-card cc-card-soft cc-stack-sm"
                  style={{
                    padding: 16,
                    background: `linear-gradient(180deg, rgba(255,255,255,0.28), ${card.tone})`,
                  }}
                >
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

          <div className="cc-card cc-stack-sm">
            <p className="cc-card-kicker">如果你是第一次來</p>
            <h2 className="cc-h2">最簡單的開始方式</h2>
            <div className="cc-note cc-stack-sm">
              <div>1. 先進同行空間，看現在有沒有適合你的房。</div>
              <div>2. 如果你比較想找固定陪跑，再去安感夥伴。</div>
              <div>3. 如果你只是想先知道規則，就先看方案與價格。</div>
            </div>
          </div>
        </aside>
      </section>

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">為什麼會有人留下來</p>
            <h2 className="cc-h2">因為這裡不是要你表現得很會社交。</h2>
          </div>
          <ul className="cc-bullets">
            <li>不必很會聊天，也能先找一段有人一起的時間。</li>
            <li>不必把所有需求都丟進一個群組裡慢慢等回應。</li>
            <li>先開始，再慢慢找到適合自己的場景與節奏。</li>
          </ul>
        </article>

        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">公開資訊</p>
            <h2 className="cc-h2">規則都看得到，但不會先壓在你臉上。</h2>
          </div>
          <div className="cc-action-row">
            <Link href="/pricing" className="cc-btn">
              方案 / 價格
            </Link>
            <Link href="/contact" className="cc-btn">
              客服
            </Link>
            <Link href="/refund-policy" className="cc-btn">
              退款政策
            </Link>
          </div>
          <div className="cc-caption">
            想先了解方案、客服、退款或隱私規則，都有公開頁面可以查。
          </div>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
