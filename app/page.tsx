import { Image20Footer, Image20TopNav } from "@/components/image20/Image20Chrome";
import { Image20SceneCards } from "@/components/image20/Image20Shared";

const trust = [
  ["✦", "每月 4 場免費體驗", "新朋友也能先體驗"],
  ["ϟ", "可立即進房", "想找人，現在就能開始"],
  ["▣", "可排程房間", "提前預約，更好安排"],
  ["◇", "公開規則與支援", "遇到問題有人協助"],
] as const;

export default function HomePage() {
  return (
    <main className="i20-root i20-dark" data-image20-dom-page="homepage-v6">
      <section className="i20-hero" style={{ minHeight: "100vh" }}>
        <div className="i20-hero-media" style={{ backgroundImage: "url(/site-assets/image20/hero/brand-hero-evening-shared-presence.png)" }} />
        <Image20TopNav dark />
        <div className="i20-hero-content">
          <span className="i20-kicker">給獨自撐著的你，一個安靜靠岸的地方</span>
          <h1>今天，不用一個人開始。</h1>
          <p>一起做事、一起生活、一起分享、一起靜靜陪伴。在安感島，每一次登入，都不只是完成任務，而是走進一個有人在的空間。</p>
          <div className="i20-actions-row">
            <a href="/rooms" className="i20-btn">進入同行空間</a>
            <a href="/buddies" className="i20-btn peach">找安感夥伴</a>
          </div>
        </div>
        <div className="i20-trust">
          {trust.map(([icon, title, body]) => <div key={title}><span>{icon}</span><div><b>{title}</b><small>{body}</small></div></div>)}
        </div>
      </section>
      <section className="i20-section" style={{ background: "#07151d" }}>
        <div className="i20-section-head" style={{ color: "#fff7ec" }}>
          <div><span className="i20-kicker">Rooms</span><h2>你可以在這裡找到的陪伴方式</h2></div>
          <a href="/rooms" style={{ color: "#fff7ec" }}>探索更多房間 →</a>
        </div>
        <Image20SceneCards />
      </section>
      <section className="i20-section" style={{ background: "var(--i20-paper)" }}>
        <div className="i20-grid four">
          {["低壓力的相遇", "尊重每個人的節奏", "隱私與安全優先", "AI 夥伴陪行"].map((title, i) => (
            <article className="i20-card" key={title}>
              <span className="i20-kicker">0{i + 1}</span><h3>{title}</h3>
              <p>{i === 3 ? "AI 是安靜的輔助層，不會喧賓奪主，也不假裝未完成的能力已經上線。" : "不用表演、不強迫開鏡頭、不把陪伴做成壓迫感社交。"}</p>
            </article>
          ))}
        </div>
      </section>
      <Image20Footer />
    </main>
  );
}
