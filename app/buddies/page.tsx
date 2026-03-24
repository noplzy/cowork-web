import Link from "next/link";
import { TopNav } from "@/components/TopNav";

const companionIdeas = [
  "讀書陪跑：一起待在同一段時間裡，把該做的事慢慢做完。",
  "工作同行：適合需要有人一起開工、一起守節奏的人。",
  "溫和支持：不吵、不催，偏向低壓力的陪伴感。",
];

const currentNotes = [
  "目前這一頁先呈現方向與氛圍，幫你理解安感夥伴的定位。",
  "正式的合作細節與更完整的媒合方式，會在整理好之後逐步開放。",
  "如果你現在想立刻開始，建議先回到 Rooms 進入專注共工。",
];

export default function BuddiesPage() {
  return (
    <main className="cc-container">
      <TopNav />

      <section className="cc-hero">
        <div className="cc-card cc-hero-main">
          <span className="cc-kicker">Companion Track</span>
          <p className="cc-eyebrow">安感夥伴｜比起硬配對，更在意此刻適不適合同行</p>
          <h1 className="cc-h1">不是隨便找個人湊數，而是留一個能被好好陪伴的位置。</h1>
          <p className="cc-lead">
            安感夥伴想提供的是低壓力、好理解、讓人感到安心的同行方式。
            這裡先帶你看見方向與氛圍，幫你理解未來會是什麼樣的陪伴感。
          </p>
          <div className="cc-action-row">
            <Link className="cc-btn-primary" href="/rooms">
              先回到共工主線
            </Link>
            <Link className="cc-btn" href="/account">
              查看目前方案
            </Link>
          </div>
        </div>

        <div className="cc-hero-side">
          <div className="cc-card cc-stack-md">
            <div className="cc-card-row">
              <div>
                <p className="cc-card-kicker">目前狀態</p>
                <h2 className="cc-h2">方向預覽</h2>
              </div>
              <span className="cc-pill-accent">逐步整理中</span>
            </div>
            <ul className="cc-bullets">
              {currentNotes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="cc-card cc-card-soft cc-stack-sm">
            <p className="cc-card-kicker">品牌感受</p>
            <h3 className="cc-h3">陪伴不是黏膩，也不是被迫社交。</h3>
            <p className="cc-muted" style={{ margin: 0, lineHeight: 1.7 }}>
              安感夥伴希望保留溫度，但不讓人有被推著互動的壓力。
            </p>
          </div>
        </div>
      </section>

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-md">
          <div>
            <p className="cc-card-kicker">可能的同行方式</p>
            <h2 className="cc-h2">你可以期待什麼樣的陪伴感</h2>
          </div>
          <ul className="cc-bullets">
            {companionIdeas.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="cc-card cc-card-outline cc-stack-md">
          <div>
            <p className="cc-card-kicker">現在可以先怎麼用</p>
            <h2 className="cc-h2">先熟悉整體節奏</h2>
          </div>
          <div className="cc-note cc-stack-sm">
            <div className="cc-h3">建議做法</div>
            <div className="cc-muted">先從 Rooms 開始使用，感受安感島的共工節奏；之後再回來看安感夥伴是否適合你。</div>
          </div>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.75 }}>
            這樣會比一開始就嘗試太多功能，更容易找到適合自己的使用方式。
          </p>
        </article>
      </section>
    </main>
  );
}
