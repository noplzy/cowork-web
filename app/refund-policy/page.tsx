import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";

export default function RefundPolicyPage() {
  return (
    <main className="cc-container">
      <TopNav />

      <section className="cc-card cc-stack-lg">
        <div className="cc-stack-sm">
          <span className="cc-kicker">Refund & Cancellation Policy</span>
          <p className="cc-eyebrow">退款 / 取消政策</p>
          <h1 className="cc-h2">付款前先看清楚，之後爭議會少很多。</h1>
        </div>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">1. 退款申請期限</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            付款完成後 7 天內，可就符合條件的訂單提出退款申請。請透過客服表單提供付款資訊與帳號 Email。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">2. 可退款情況</h2>
          <ul className="cc-bullets">
            <li>付款成功後，VIP 權益在合理時間內仍未生效</li>
            <li>因系統異常導致重複扣款</li>
            <li>首次訂購後尚未實際使用主要 VIP 權益，且於 7 天內提出申請</li>
          </ul>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">3. 不可退款情況</h2>
          <ul className="cc-bullets">
            <li>已超過付款後 7 天</li>
            <li>VIP 權益已正常生效且已明顯使用</li>
            <li>因帳號共享、違反服務條款或使用規範導致停權或限制</li>
          </ul>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">4. 重複扣款與未生效處理</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            若你懷疑發生重複扣款或權益未生效，請在客服表單中提供付款時間、金額與帳號 Email，我們會先協助人工確認。
          </p>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
