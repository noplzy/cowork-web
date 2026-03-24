import { TopNav } from "@/components/TopNav";

export default function AboutPage() {
  return (
    <main className="cc-container">
      <TopNav />

      <section className="cc-hero">
        <div className="cc-card cc-hero-main">
          <span className="cc-kicker">About ANGANDAO</span>
          <p className="cc-eyebrow">關於安感島｜營業資訊與服務方向</p>
          <h1 className="cc-h1">安感島是一個把規則講清楚、把節奏放穩的數位空間。</h1>
          <p className="cc-lead">
            我們想做的不是高壓衝刺，而是一個讓使用者能在低壓力狀態下開始、停留與完成事情的服務。現階段以專注共工房間與方案權益作為核心體驗，後續再逐步補齊更多陪伴型功能。
          </p>
        </div>

        <div className="cc-hero-side">
          <div className="cc-card cc-stack-sm">
            <p className="cc-card-kicker">公開資訊</p>
            <div className="cc-note cc-stack-sm">
              <div>品牌名稱：安感島</div>
              <div>賣家類型：個人</div>
              <div>地址：高雄市前鎮區廣東三街89號</div>
              <div>Email：noccs75@gmail.com</div>
              <div>電話：0968730221</div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
