import { Image20Footer, Image20TopNav } from "@/components/image20/Image20Chrome";
import { Image20SceneCards } from "@/components/image20/Image20Shared";

const trust = [
  ["✦", "每月免費體驗", "新朋友也能先試試看"],
  ["↪", "可立即進房", "想開始時，現在就能開始"],
  ["▣", "可排程房間", "先約好一段比較安心的時間"],
  ["◇", "公開規則與支援", "透明安心，遇到問題有人協助"],
] as const;

const philosophy = [
  ["低壓力相遇", "不用自我介紹、不用表演，也可以慢慢來。"],
  ["尊重每個人的節奏", "你可以專注、可以聊天，也可以只是靜靜待著。"],
  ["隱私與安全優先", "公開規則、房間邊界與支援機制，讓你安心出現。"],
  ["AI Companion 靜靜在旁", "需要時提供引導，不需要時保持安靜。"],
] as const;

export default function HomePage() {
  return (
    <main className="i20-root i20-dark" data-image20-dom-page="homepage-v8-v2-style">
      <section className="i20-hero i20-home-hero">
        <div className="i20-hero-media" style={{ backgroundImage: "url(/site-assets/image20/hero/brand-hero-evening-shared-presence.png)" }} />
        <Image20TopNav dark />
        <div className="i20-hero-content">
          <span className="i20-kicker">給想有人一起的你，一個安心安靜的地方</span>
          <h1>今天，不用一個人開始。</h1>
          <p>一起做事、一起生活、一起分享、一起安靜陪伴。在安感島，每一次登入，都不只是完成任務，而是走進一個有人在的空間。</p>
          <div className="i20-actions-row">
            <a href="/rooms" className="i20-btn">進入同行空間</a>
            <a href="/buddies" className="i20-btn peach">找安感夥伴</a>
          </div>
        </div>
        <div className="i20-trust">
          {trust.map(([icon, title, body]) => (
            <div key={title}>
              <span>{icon}</span>
              <div><b>{title}</b><small>{body}</small></div>
            </div>
          ))}
        </div>
      </section>

      <section className="i20-section i20-home-scene-section">
        <div className="i20-section-head" style={{ color: "#fff7ec" }}>
          <div>
            <span className="i20-kicker">Rooms</span>
            <h2>你可以在這裡找到的陪伴方式</h2>
          </div>
          <a href="/rooms" style={{ color: "#fff7ec" }}>探索更多房間 →</a>
        </div>
        <Image20SceneCards />
      </section>

      <section className="i20-section i20-ivory-band">
        <div className="i20-grid four">
          {philosophy.map(([title, body], index) => (
            <article className="i20-card i20-philosophy-card" key={title}>
              <span className="i20-kicker">0{index + 1}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <Image20Footer />
    </main>
  );
}
