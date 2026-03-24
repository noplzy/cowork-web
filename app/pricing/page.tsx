import Link from "next/link";
import { TopNav } from "@/components/TopNav";

export default function PricingPage() {
  return (
    <main className="cc-container">
      <TopNav />

      <section className="cc-hero">
        <div className="cc-card cc-hero-main">
          <span className="cc-kicker">Pricing</span>
          <p className="cc-eyebrow">方案與價格｜付款前先看清楚，使用時更安心</p>
          <h1 className="cc-h1">先知道規則、價格與續訂方式，再決定要不要升級。</h1>
          <p className="cc-lead">
            安感島目前提供免費方案與 VIP 方案。免費方案適合先體驗整體節奏；VIP 方案則提供不受場次限制的續場體驗。
          </p>
          <div className="cc-page-meta">
            <span className="cc-pill-warning">免費每月 4 場</span>
            <span className="cc-pill-success">VIP 月費 NT$199</span>
            <span className="cc-pill-soft">VIP 年費 NT$2,000</span>
          </div>
        </div>

        <div className="cc-hero-side">
          <div className="cc-card cc-stack-sm">
            <p className="cc-card-kicker">生效方式</p>
            <h2 className="cc-h2">付款成功後立即生效</h2>
            <p className="cc-muted" style={{ margin: 0, lineHeight: 1.75 }}>
              付款成功後，系統會盡快更新你的 VIP 權益；若發生異常，請透過客服頁提供付款資訊與帳號 Email，我們會協助處理。
            </p>
          </div>
          <div className="cc-card cc-card-soft cc-stack-sm">
            <p className="cc-card-kicker">續訂方式</p>
            <p className="cc-muted" style={{ margin: 0, lineHeight: 1.75 }}>
              VIP 方案採自動續訂，若你不希望下期自動續費，請於下一期扣款前聯繫客服辦理取消。
            </p>
          </div>
        </div>
      </section>

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-md">
          <div className="cc-card-row">
            <div>
              <p className="cc-card-kicker">Free</p>
              <h2 className="cc-h2">免費方案</h2>
            </div>
            <span className="cc-pill-warning">NT$0</span>
          </div>
          <div className="cc-note cc-stack-sm">
            <div>每月 4 場專注使用額度</div>
            <div>25 分鐘房間消耗 1 場</div>
            <div>50 分鐘房間消耗 2 場</div>
            <div>可查看房間列表、帳號方案與公開政策頁</div>
          </div>
          <div className="cc-action-row">
            <Link href="/auth/signup" className="cc-btn">先建立免費帳號</Link>
          </div>
        </article>

        <article className="cc-card cc-stack-md">
          <div className="cc-card-row">
            <div>
              <p className="cc-card-kicker">VIP</p>
              <h2 className="cc-h2">VIP 方案</h2>
            </div>
            <span className="cc-pill-success">NT$199 / 月</span>
          </div>
          <div className="cc-note cc-stack-sm">
            <div>可無限續場，不受每月場次限制</div>
            <div>Pair 房如有 VIP，可協助同房另一位使用者一起續場</div>
            <div>付款成功後權益立即生效</div>
            <div>提供年費方案 NT$2,000 / 年</div>
          </div>
          <div className="cc-action-row">
            <Link href="/contact" className="cc-btn-primary">聯絡客服了解付款開通</Link>
            <Link href="/refund-policy" className="cc-btn">查看退款與取消政策</Link>
          </div>
        </article>
      </section>
    </main>
  );
}
