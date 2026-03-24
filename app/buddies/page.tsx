import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";

const companionIdeas = [
  "讀書陪跑：一起待在同一段時間裡，把該做的事慢慢做完。",
  "工作同行：適合需要有人一起開工、一起守節奏的人。",
  "溫和支持：不吵、不催，偏向低壓力的陪伴感。",
];

const serviceNotes = [
  "安感夥伴重視的是相處節奏與安全感，而不是尷尬的硬配對。",
  "使用者可以先從 Rooms 熟悉整體氛圍，再視需求選擇是否使用陪伴服務。",
  "若你在意使用方式、價格或客服窗口，也可以直接查看公開說明頁。 ",
];

export default function BuddiesPage() {
  return (
    <main className="cc-container">
      <TopNav />

      <section className="cc-hero">
        <div className="cc-card cc-hero-main">
          <span className="cc-kicker">Companion Service</span>
          <p className="cc-eyebrow">安感夥伴｜比起硬配對，更在意此刻適不適合同行</p>
          <h1 className="cc-h1">不是隨便找個人湊數，而是留一個能被好好陪伴的位置。</h1>
          <p className="cc-lead">
            安感夥伴想提供的是低壓力、好理解、讓人感到安心的同行方式。
            不論你是想有人一起讀書、一起開工，或只是想減少獨自撐著的感覺，都可以先從這裡了解服務。
          </p>
          <div className="cc-action-row">
            <Link className="cc-btn-primary" href="/rooms">
              前往 Rooms
            </Link>
            <Link className="cc-btn" href="/pricing">
              查看方案 / 價格
            </Link>
          </div>
        </div>

        <div className="cc-hero-side">
          <div className="cc-card cc-stack-md">
            <div className="cc-card-row">
              <div>
                <p className="cc-card-kicker">服務特色</p>
                <h2 className="cc-h2">低壓力、可理解、可持續</h2>
              </div>
              <span className="cc-pill-accent">陪伴服務</span>
            </div>
            <ul className="cc-bullets">
              {serviceNotes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="cc-card cc-card-soft cc-stack-sm">
            <p className="cc-card-kicker">適合誰</p>
            <h3 className="cc-h3">想被陪伴，但不想被逼著社交的人。</h3>
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
            <p className="cc-card-kicker">現在可以怎麼開始</p>
            <h2 className="cc-h2">先熟悉整體節奏，再選擇適合的陪伴方式</h2>
          </div>
          <div className="cc-note cc-stack-sm">
            <div className="cc-h3">建議做法</div>
            <div className="cc-muted">先從 Rooms 開始使用，感受安感島的共工節奏；之後再決定是否需要安感夥伴。</div>
          </div>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.75 }}>
            這樣會比一開始就嘗試太多功能，更容易找到適合自己的使用方式。
          </p>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
