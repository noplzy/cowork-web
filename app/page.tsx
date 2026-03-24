import Link from "next/link";

const highlights = [
  "25 分鐘與 50 分鐘時間盒，進房規則清楚好懂。",
  "低壓力陪伴感，不把專注做成吵鬧競賽。",
  "方案與額度透明，使用前就知道自己能怎麼用。",
];

const trustNotes = [
  { label: "專注共工", value: "25m / 50m 時間盒" },
  { label: "安感夥伴", value: "陪伴與同行方向" },
  { label: "整體感受", value: "安靜、低壓力、可預期" },
];

export default function Home() {
  return (
    <main className="cc-container">
      <section className="cc-hero">
        <div className="cc-card cc-hero-main">
          <span className="cc-kicker">Warm Quiet Digital Sanctuary</span>
          <p className="cc-eyebrow">安感島｜安靜、高質感、低壓力的數位避風港</p>
          <h1 className="cc-h1">一個人撐著的時候，也能有地方安靜靠岸。</h1>
          <p className="cc-lead">
            安感島是一個讓你安穩開始、好好待住的數位空間。你可以進來專注完成眼前的一段時間，
            也可以在需要陪伴的時候，看看是否有適合自己的同行方式。
          </p>

          <div className="cc-action-row">
            <Link href="/rooms" className="cc-btn-primary">
              進入專注共工
            </Link>
            <Link href="/buddies" className="cc-btn">
              看看安感夥伴
            </Link>
            <Link href="/auth/login" className="cc-btn-link">
              登入 / 註冊 →
            </Link>
          </div>

          <div className="cc-grid-metrics cc-section">
            {trustNotes.map((item) => (
              <div key={item.label} className="cc-metric">
                <span className="cc-metric-label">{item.label}</span>
                <div className="cc-metric-value" style={{ fontSize: "1.1rem" }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="cc-hero-side">
          <div className="cc-card cc-feature-card cc-stack-md">
            <div className="cc-card-row">
              <div>
                <p className="cc-card-kicker">使用感受</p>
                <h2 className="cc-h2">安靜、溫柔、可久待</h2>
              </div>
              <span className="cc-pill-accent">Calm Premium</span>
            </div>
            <ul className="cc-bullets">
              {highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="cc-card cc-card-soft cc-stack-sm">
            <div className="cc-card-row">
              <div>
                <p className="cc-card-kicker">開始方式</p>
                <h3 className="cc-h3">先選一條適合現在狀態的入口。</h3>
              </div>
              <span className="cc-pill-success">清楚好上手</span>
            </div>
            <p className="cc-muted" style={{ lineHeight: 1.75, margin: 0 }}>
              想馬上開始做事，就進 Rooms；想先看看陪伴方向與未來服務輪廓，就去安感夥伴頁。
              入口清楚，使用節奏也應該清楚。
            </p>
          </div>
        </div>
      </section>

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-card-link">
          <div className="cc-card-row">
            <div>
              <p className="cc-card-kicker">入口一</p>
              <h2 className="cc-h2">🎯 專注共工</h2>
            </div>
            <span className="cc-pill-soft">25m / 50m</span>
          </div>
          <p className="cc-lead" style={{ marginTop: 12, maxWidth: "unset" }}>
            給現在就想開始的人。選一個房間、看清本場規則，讓自己在一段明確的時間裡穩穩待住。
          </p>
          <div className="cc-page-meta">
            <span className="cc-pill-warning">免費每月 4 場</span>
            <span className="cc-pill-soft">VIP 可無限續場</span>
          </div>
          <div className="cc-action-row">
            <Link href="/rooms" className="cc-btn-primary">前往 Rooms</Link>
          </div>
        </article>

        <article className="cc-card cc-card-link">
          <div className="cc-card-row">
            <div>
              <p className="cc-card-kicker">入口二</p>
              <h2 className="cc-h2">🤝 安感夥伴</h2>
            </div>
            <span className="cc-pill-soft">陪伴方向</span>
          </div>
          <p className="cc-lead" style={{ marginTop: 12, maxWidth: "unset" }}>
            給想找陪跑感、同行感或未來合作可能的人。這裡先呈現方向與氛圍，幫你快速理解安感夥伴想提供的感受。
          </p>
          <div className="cc-page-meta">
            <span className="cc-pill-accent">低壓力陪伴</span>
            <span className="cc-pill-soft">逐步整理中</span>
          </div>
          <div className="cc-action-row">
            <Link href="/buddies" className="cc-btn">前往安感夥伴</Link>
          </div>
        </article>
      </section>

      <section className="cc-section cc-grid-3">
        <article className="cc-card cc-stack-sm">
          <p className="cc-card-kicker">方案與額度</p>
          <h3 className="cc-h3">清楚看到自己現在能用到哪裡</h3>
          <p className="cc-muted" style={{ lineHeight: 1.7, margin: 0 }}>
            查看本月場次、VIP 狀態與續場規則。使用前先知道，體驗就比較安心。
          </p>
          <Link href="/account" className="cc-btn-link">查看方案 →</Link>
        </article>

        <article className="cc-card cc-stack-sm">
          <p className="cc-card-kicker">品牌語氣</p>
          <h3 className="cc-h3">溫柔，但不幼態；陪伴，但不黏膩</h3>
          <p className="cc-muted" style={{ lineHeight: 1.7, margin: 0 }}>
            安感島不是效率崇拜，也不是情緒表演。它提供的是熟悉、安靜、可以久待的感覺。
          </p>
        </article>

        <article className="cc-card cc-stack-sm">
          <p className="cc-card-kicker">使用方式</p>
          <h3 className="cc-h3">把步驟變簡單，讓人更容易留下來</h3>
          <p className="cc-muted" style={{ lineHeight: 1.7, margin: 0 }}>
            入口清楚、規則清楚、權益清楚。少一點猜測，就多一點願意回來的理由。
          </p>
        </article>
      </section>
    </main>
  );
}
