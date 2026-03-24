import Link from "next/link";

const focusSignals = [
  "共工模式：25m / 50m 時間盒，規則清楚、成本清楚、續場邏輯清楚。",
  "搭子模式：先做陪伴與需求驗證，再決定上架、抽成與金流細節。",
  "整體體驗：不是催促你變厲害，而是讓你比較不孤單地把事情做完。",
];

const trustNotes = [
  { label: "共工入口", value: "Rooms / 低壓力專注" },
  { label: "搭子入口", value: "陪伴 / 專業夥伴" },
  { label: "產品原則", value: "清楚、溫柔、可信" },
];

export default function Home() {
  return (
    <main className="cc-container">
      <section className="cc-hero">
        <div className="cc-card cc-hero-main cc-hero-main">
          <span className="cc-kicker">Warm Quiet Digital Sanctuary</span>
          <p className="cc-eyebrow">安感島｜為孤獨經濟設計的低壓力數位避風港</p>
          <h1 className="cc-h1">一個人撐著的時候，也能有地方安靜靠岸。</h1>
          <p className="cc-lead">
            安感島不是炫技型網站，也不是吵鬧社群。它更像一座節奏慢一點、呼吸感多一點的數位島嶼：
            你可以進來專注工作，也可以在需要的時候，找到願意陪你一起撐過去的人。
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
                <p className="cc-card-kicker">品牌方向</p>
                <h2 className="cc-h2">安靜、高級、有陪伴感</h2>
              </div>
              <span className="cc-pill-accent">Calm Premium</span>
            </div>
            <ul className="cc-bullets">
              {focusSignals.map((signal) => (
                <li key={signal}>{signal}</li>
              ))}
            </ul>
          </div>

          <div className="cc-card cc-card-soft cc-stack-sm">
            <div className="cc-card-row">
              <div>
                <p className="cc-card-kicker">MVP 原則</p>
                <h3 className="cc-h3">先把規則與收費閉環做對，再擴功能。</h3>
              </div>
              <span className="cc-pill-success">穩定優先</span>
            </div>
            <p className="cc-muted" style={{ lineHeight: 1.75, margin: 0 }}>
              如果你用無痕模式打開會看到登入頁面，這是正常的：無痕不會保存 Supabase session。
              安感島不追求一眼炫，而是追求你第二次、第三次還願意回來。
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
            給現在就想開始做事的人。時間盒、進房、扣場、續場規則都要清楚，這裡不是壓迫你衝刺，
            而是陪你安穩把一段時間走完。
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
            <span className="cc-pill-soft">陪伴 / 專業角色</span>
          </div>
          <p className="cc-lead" style={{ marginTop: 12, maxWidth: "unset" }}>
            給想找固定陪跑、職業搭子或低壓力同行者的人。這條線先做需求驗證與展示骨架，
            不急著把平台代收代付與抽成做死。
          </p>
          <div className="cc-page-meta">
            <span className="cc-pill-accent">先驗證需求</span>
            <span className="cc-pill-soft">避免一開始碰糾紛雷區</span>
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
            查看本月場次、VIP 狀態與續場規則。不要讓使用者猜，也不要讓付費像抽卡。
          </p>
          <Link href="/account" className="cc-btn-link">查看方案 →</Link>
        </article>

        <article className="cc-card cc-stack-sm">
          <p className="cc-card-kicker">品牌語氣</p>
          <h3 className="cc-h3">溫柔，但不幼態；陪伴，但不黏膩</h3>
          <p className="cc-muted" style={{ lineHeight: 1.7, margin: 0 }}>
            安感島不是悲傷美學，也不是效率崇拜。它提供的是熟悉、可預期、能久待的感覺。
          </p>
        </article>

        <article className="cc-card cc-stack-sm">
          <p className="cc-card-kicker">產品底線</p>
          <h3 className="cc-h3">能收錢、能防濫用、能讓人信任</h3>
          <p className="cc-muted" style={{ lineHeight: 1.7, margin: 0 }}>
            MVP 的重點不是功能越多越好，而是把規則講清楚、把主流程做穩，讓未來功能擴張有地基。
          </p>
        </article>
      </section>
    </main>
  );
}
