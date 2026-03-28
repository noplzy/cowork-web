import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";

export default function ServiceDeliveryPage() {
  return (
    <main className="cc-container">
      <TopNav />

      <section className="cc-card cc-stack-lg">
        <div className="cc-stack-sm">
          <span className="cc-kicker">Service Delivery</span>
          <p className="cc-eyebrow">服務交付說明</p>
          <h1 className="cc-h2">付款後會拿到什麼、何時生效、出問題怎麼處理</h1>
        </div>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">1. 目前提供的服務</h2>
          <ul className="cc-bullets">
            <li>Rooms：25 分鐘與 50 分鐘專注房間</li>
            <li>帳號方案：免費方案與 VIP 方案</li>
            <li>客服與公開政策頁</li>
          </ul>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">2. 付款後如何生效</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            若你購買 VIP 方案，付款成功後系統應更新你的方案權益。若出現異常，請透過客服表單提供付款時間、金額與帳號 Email。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">3. 權益在哪裡看</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            登入後可在「方案 / 額度」頁查看目前方案、剩餘額度與使用狀態。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">4. 若權益未生效</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            我們會先協助人工確認與補開通；若最終無法正常提供服務，則依退款 / 取消政策處理。
          </p>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
