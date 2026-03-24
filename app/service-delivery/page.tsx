import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";

export default function ServiceDeliveryPage() {
  return (
    <main className="cc-container">
      <TopNav />

      <section className="cc-card cc-stack-lg">
        <div className="cc-stack-sm">
          <span className="cc-kicker">Service Delivery</span>
          <p className="cc-eyebrow">服務交付說明｜付款後會拿到什麼、何時生效、出問題怎麼處理</p>
          <h1 className="cc-h2" style={{ fontSize: "clamp(1.8rem, 3vw, 2.8rem)" }}>安感島服務交付說明</h1>
        </div>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">1. 目前提供的服務</h2>
          <ul className="cc-bullets">
            <li>Rooms：25 分鐘與 50 分鐘的專注共工房間。</li>
            <li>安感夥伴：陪伴型服務說明與後續使用入口。</li>
            <li>帳號方案：免費方案與 VIP 方案。</li>
          </ul>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">2. 付款後如何生效</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            若你購買 VIP 方案，付款成功後系統會更新你的方案權益，讓你可依 VIP 規則繼續使用服務。若出現異常，請透過客服頁聯繫我們並提供付款時間、金額與帳號 Email。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">3. 使用者在哪裡查看權益</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            登入後可在「方案 / 額度」頁查看目前方案、剩餘額度與使用狀態。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">4. 權益未生效時怎麼處理</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            若付款成功但權益未正確更新，我們會先協助人工確認與補開通；若最終無法正常提供服務，則依退款 / 取消政策處理。
          </p>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
