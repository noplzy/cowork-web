import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";

export default function PricingPage() {
  return (
    <main className="cc-container">
      <TopNav />

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-md">
          <span className="cc-kicker">Pricing</span>
          <p className="cc-eyebrow">先看規則，再決定要不要升級。</p>
          <h1 className="cc-h2">方案與價格</h1>
          <div className="cc-page-meta">
            <span className="cc-pill-warning">免費每月 4 場</span>
            <span className="cc-pill-success">VIP 月費 NT$199</span>
            <span className="cc-pill-soft">VIP 年費 NT$2,000</span>
          </div>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            這一頁只保留使用前最需要知道的資訊：免費額度、VIP 權益、續訂與退款入口。
          </p>
        </article>

        <article className="cc-card cc-stack-sm">
          <p className="cc-card-kicker">使用前先知道</p>
          <ul className="cc-bullets">
            <li>25 分鐘房消耗 1 場。</li>
            <li>50 分鐘房消耗 2 場。</li>
            <li>VIP 可無限續場。</li>
            <li>若付款後權益未更新，請走客服表單。</li>
          </ul>
        </article>
      </section>

      <section className="cc-section cc-grid-2">
        <article className="cc-card cc-stack-sm">
          <div className="cc-card-row">
            <div>
              <p className="cc-card-kicker">Free</p>
              <h2 className="cc-h2">免費方案</h2>
            </div>
            <span className="cc-pill-warning">NT$0</span>
          </div>
          <div className="cc-note cc-stack-sm">
            <div>每月 4 場</div>
            <div>可查看公開頁與基本帳號功能</div>
            <div>適合先測試整體節奏</div>
          </div>
          <div className="cc-action-row">
            <Link href="/auth/signup" className="cc-btn">建立免費帳號</Link>
          </div>
        </article>

        <article className="cc-card cc-stack-sm">
          <div className="cc-card-row">
            <div>
              <p className="cc-card-kicker">VIP</p>
              <h2 className="cc-h2">VIP 方案</h2>
            </div>
            <span className="cc-pill-success">NT$199 / 月</span>
          </div>
          <div className="cc-note cc-stack-sm">
            <div>可無限續場</div>
            <div>提供年費方案 NT$2,000 / 年</div>
            <div>付款成功後應立即生效</div>
          </div>
          <div className="cc-action-row">
            <Link href="/service-delivery" className="cc-btn-primary">服務交付</Link>
            <Link href="/refund-policy" className="cc-btn">退款政策</Link>
          </div>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
