"use client";

import Link from "next/link";
import { CSSProperties, useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { getClientSessionSnapshot } from "@/lib/clientAuth";

const HERO_VIDEO = "/site-assets/hero/hero-loop.mp4";
const HERO_POSTER = "/site-assets/hero/hero-window.png";

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
    title: "專注任務",
    body: "讀書、工作、寫作、整理資料。有人一起，開始比較不難。",
    pills: ["25 / 50 分鐘", "安靜同行"],
    tone: "var(--cc-scene-focus)",
    image: "/site-assets/rooms/focus.png",
    alt: "專注任務場景卡圖",
  },
  {
    title: "生活陪伴",
    body: "做家務、收納、煮飯、陪自己過完一段普通日常。",
    pills: ["低壓力", "輕聊天"],
    tone: "var(--cc-scene-life)",
    image: "/site-assets/rooms/life.png",
    alt: "生活陪伴場景卡圖",
  },
  {
    title: "主題分享",
    body: "有一個明確主題，大家一起聊完，不需要把自己丟進吵雜群組。",
    pills: ["分享房", "開放交流"],
    tone: "var(--cc-scene-share)",
    image: "/site-assets/rooms/share.png",
    alt: "主題分享場景卡圖",
  },
  {
    title: "興趣同好",
    body: "讀書會、手作、畫圖、樂器、一起做喜歡的事，不一定要熱鬧。",
    pills: ["同好房", "有呼吸感"],
    tone: "var(--cc-scene-hobby)",
    image: "/site-assets/rooms/hobby.png",
    alt: "興趣同好場景卡圖",
  },
];

const mediaCardStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  minHeight: "100%",
  overflow: "hidden",
};

const mediaFrameStyle = (image: string): CSSProperties => ({
  width: "100%",
  aspectRatio: "4 / 3",
  borderRadius: 18,
  border: "1px solid rgba(89,88,82,0.10)",
  backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04)), url(${image})`,
  backgroundPosition: "center",
  backgroundSize: "cover",
  boxShadow: "var(--cc-shadow-sm)",
});

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
        <article
          className="cc-card cc-hero-main"
          style={{
            position: "relative",
            overflow: "hidden",
            minHeight: 560,
            padding: 0,
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              overflow: "hidden",
              borderRadius: 22,
            }}
          >
            <video
              autoPlay
              muted
              loop
              playsInline
              poster={HERO_POSTER}
              preload="metadata"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center center",
              }}
            >
              <source src={HERO_VIDEO} type="video/mp4" />
            </video>
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(90deg, rgba(250,245,240,0.84) 0%, rgba(250,245,240,0.72) 36%, rgba(248,241,233,0.28) 72%, rgba(248,241,233,0.16) 100%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.00) 24%, rgba(28,28,28,0.04) 100%)",
              }}
            />
          </div>

          <div
            className="cc-stack-md"
            style={{
              position: "relative",
              zIndex: 1,
              padding: 32,
              minHeight: 560,
              justifyContent: "space-between",
            }}
          >
            <div className="cc-stack-md">
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
            </div>

            <div
              className="cc-card cc-card-soft"
              style={{
                width: "min(100%, 420px)",
                padding: 18,
                background: "linear-gradient(180deg, rgba(255,255,255,0.36), rgba(255,255,255,0.18))",
                borderColor: "rgba(255,255,255,0.34)",
                backdropFilter: "blur(10px)",
              }}
            >
              <p className="cc-card-kicker">第一次來也不會迷路</p>
              <div className="cc-note cc-stack-sm" style={{ background: "rgba(255,255,255,0.14)" }}>
                <div>1. 先進同行空間，看現在有沒有適合你的房。</div>
                <div>2. 如果你比較想找固定陪跑，再去安感夥伴。</div>
                <div>3. 如果你只是想先知道規則，就先看方案與價格。</div>
              </div>
            </div>
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
            <p className="cc-card-kicker">你會在這裡遇到的場景</p>
            <h2 className="cc-h2">先看得懂差別，再決定要去哪裡。</h2>
            <div className="cc-caption">
              場景卡不是為了做花，是為了讓人一眼知道：現在要進的是工作、生活、交流，還是興趣房。
            </div>
          </div>
        </aside>
      </section>

      <section className="cc-section cc-stack-md">
        <div className="cc-page-header" style={{ marginBottom: 0 }}>
          <div>
            <p className="cc-card-kicker">同行場景</p>
            <h2 className="cc-h2">一眼看懂你要進哪一種房，而不是先讀一堆說明。</h2>
          </div>
          <Link href="/rooms" className="cc-btn">
            進入 Rooms
          </Link>
        </div>

        <div className="cc-grid-2">
          {sceneCards.map((card) => (
            <Link key={card.title} href="/rooms" className="cc-card cc-card-link" style={mediaCardStyle}>
              <div style={mediaFrameStyle(card.image)} aria-label={card.alt} />
              <div className="cc-stack-sm">
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
              </div>
            </Link>
          ))}
        </div>
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
