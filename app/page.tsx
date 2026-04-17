import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import type { CSSProperties } from "react";

export const revalidate = 300;

const HERO_POSTER = "/site-assets/hero/hero-window.png";

const primaryPaths = [
  {
    title: "現在就進房",
    body: "想立刻開始，就先進 Rooms 看現在有沒有適合你的房。",
    href: "/rooms?mode=now#rooms-board",
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
    title: "先看方案 / 規則",
    body: "還沒決定也沒關係，先看價格、客服與退款政策就好。",
    href: "/pricing",
    cta: "查看方案 / 價格",
    tone: "var(--cc-scene-share)",
  },
] as const;

const sceneCards = [
  {
    key: "focus",
    title: "專注任務",
    body: "一起安靜完成今天的事。讀書、工作、寫作、整理資料都適合。",
    pills: ["安靜同行", "25 / 50 分鐘"],
    image: "/site-assets/rooms/focus.png",
    alt: "專注任務場景卡圖",
    href: "/rooms?mode=now&scene=focus#rooms-board",
  },
  {
    key: "life",
    title: "生活陪伴",
    body: "一起過日常的一小段時間。整理、做家務、煮飯、陪自己過生活。",
    pills: ["低壓力", "輕聊天"],
    image: "/site-assets/rooms/life.png",
    alt: "生活陪伴場景卡圖",
    href: "/rooms?mode=now&scene=life#rooms-board",
  },
  {
    key: "share",
    title: "主題分享",
    body: "圍繞同一個主題，把一場對話好好聊完，不用被吵雜群組淹沒。",
    pills: ["分享房", "開放交流"],
    image: "/site-assets/rooms/share.png",
    alt: "主題分享場景卡圖",
    href: "/rooms?mode=now&scene=share#rooms-board",
  },
  {
    key: "hobby",
    title: "興趣同好",
    body: "一起做喜歡的事。畫圖、閱讀、手作、樂器，不一定要熱鬧。",
    pills: ["同好房", "有呼吸感"],
    image: "/site-assets/rooms/hobby.png",
    alt: "興趣同好場景卡圖",
    href: "/rooms?mode=now&scene=hobby#rooms-board",
  },
] as const;

const SCENE_MEDIA_POSITION: Record<(typeof sceneCards)[number]["key"], string> = {
  focus: "50% 61%",
  life: "50% 58%",
  share: "50% 52%",
  hobby: "76% 52%",
};

const sceneMediaStyle = (image: string, position: string): CSSProperties => ({
  width: "100%",
  aspectRatio: "16 / 10",
  borderRadius: 18,
  border: "1px solid rgba(89,88,82,0.10)",
  backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03)), url(${image})`,
  backgroundPosition: position,
  backgroundSize: "cover",
  boxShadow: "var(--cc-shadow-sm)",
});

export default function Home() {
  return (
    <main className="cc-container">
      <TopNav />

      <section className="cc-section">
        <article
          className="cc-card cc-home-hero-card cc-home-hero-card--image"
          style={{
            backgroundImage: `
              linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.02) 45%, rgba(22,25,30,0.06) 57%, rgba(22,25,30,0.18) 68%, rgba(22,25,30,0.34) 82%, rgba(22,25,30,0.46) 100%),
              url(${HERO_POSTER})
            `,
          }}
        >
          <div className="cc-home-hero-stage">
            <div className="cc-home-hero-copy cc-home-hero-copy--floating cc-stack-md">
              <span className="cc-kicker">Calm&Co / 安感島</span>
              <p className="cc-home-hero-eyebrow">給獨自撐著的你，一個安靜靠岸的地方。</p>
              <h1 className="cc-h1 cc-home-hero-title" style={{ maxWidth: "8ch" }}>
                今天不用一個人開始。
              </h1>
              <p className="cc-home-hero-lead" style={{ maxWidth: "34ch" }}>
                想立刻找人一起做事、一起待著，或想找更明確的陪伴夥伴，都可以從這裡開始。
              </p>

              <div className="cc-home-hero-actions">
                <Link href="/rooms?mode=now#rooms-board" className="cc-btn-primary cc-home-hero-btn-primary">
                  進入同行空間
                </Link>
                <Link href="/buddies" className="cc-btn cc-home-hero-btn-secondary">
                  找安感夥伴
                </Link>
              </div>

              <div className="cc-page-meta cc-home-hero-meta cc-desktop-only">
                <span className="cc-pill-warning">免費每月 4 場</span>
                <span className="cc-pill-soft">可即時進房</span>
                <span className="cc-pill-soft">可排程</span>
                <span className="cc-pill-soft">有公開規則與客服</span>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="cc-section cc-stack-md">
        <div className="cc-page-header" style={{ marginBottom: 0 }}>
          <div>
            <p className="cc-card-kicker">先選一條路</p>
            <h2 className="cc-h2">首頁先告訴你現在可以去哪裡，不先把整座島塞給你。</h2>
          </div>
        </div>

        <div className="cc-grid-3 cc-mobile-stack-grid">
          {primaryPaths.map((card) => (
            <article
              key={card.title}
              className="cc-card cc-card-soft cc-stack-sm cc-fixed-card"
              style={{ background: `linear-gradient(180deg, rgba(255,255,255,0.30), ${card.tone})` }}
            >
              <div className="cc-fixed-card__content cc-stack-sm">
                <div className="cc-h3 cc-line-2">{card.title}</div>
                <div className="cc-muted cc-line-3" style={{ lineHeight: 1.72 }}>
                  {card.body}
                </div>
              </div>
              <Link href={card.href} className="cc-btn-link cc-fixed-card__cta">
                {card.cta} →
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="cc-section cc-stack-md">
        <div className="cc-page-header" style={{ marginBottom: 0 }}>
          <div>
            <p className="cc-card-kicker">同行場景</p>
            <h2 className="cc-h2">先看懂你要進哪一種房，而不是先讀一堆規則。</h2>
          </div>
          <Link href="/rooms?mode=now#rooms-board" className="cc-btn cc-desktop-only">
            進入 Rooms
          </Link>
        </div>

        <div className="cc-home-scene-grid">
          {sceneCards.map((card) => (
            <Link key={card.key} href={card.href} className="cc-card cc-card-link cc-home-scene-card cc-fixed-card">
              <div style={sceneMediaStyle(card.image, SCENE_MEDIA_POSITION[card.key])} aria-label={card.alt} />
              <div className="cc-fixed-card__content cc-stack-sm">
                <div className="cc-h3 cc-line-2">{card.title}</div>
                <div className="cc-muted cc-line-3" style={{ lineHeight: 1.72 }}>
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
              <span className="cc-btn-link cc-fixed-card__cta">看這種房 →</span>
            </Link>
          ))}
        </div>

        <div className="cc-mobile-only">
          <Link href="/rooms?mode=now#rooms-board" className="cc-btn-primary" style={{ width: "100%" }}>
            進入 Rooms
          </Link>
        </div>
      </section>

      <section className="cc-section cc-grid-2 cc-mobile-stack-grid">
        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">為什麼有人會留下來</p>
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
          <div className="cc-caption">想先了解方案、客服、退款或隱私規則，都有公開頁面可以查。</div>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
