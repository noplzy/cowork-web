import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";

export default function RefundPolicyPage() {
  return (
    <main className="cc-container">
      <TopNav />

      <section className="cc-card cc-stack-lg">
        <div className="cc-stack-sm">
          <span className="cc-kicker">Refund & Cancellation Policy</span>
          <p className="cc-eyebrow">退款 / 取消政策｜付款前先看清楚，之後爭議會少很多</p>
          <h1 className="cc-h2" style={{ fontSize: "clamp(1.8rem, 3vw, 2.8rem)" }}>安感島退款與取消政策</h1>
        </div>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">1. 退款申請期限</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            付款完成後 7 天內，可就符合條件的訂單提出退款申請。請透過客服 Email 或聯絡頁聯繫，並提供付款資訊與帳號 Email。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">2. 可退款情況</h2>
          <ul className="cc-bullets">
            <li>付款成功後，VIP 權益在合理處理時間內仍未生效，且經確認確實未開通。</li>
            <li>因系統異常導致重複扣款，經確認後將退回重複收取的款項。</li>
            <li>首次訂購後尚未實際使用 VIP 主要權益，且於 7 天內提出申請。</li>
          </ul>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">3. 不可退款情況</h2>
          <ul className="cc-bullets">
            <li>已超過付款後 7 天。</li>
            <li>VIP 權益已正常生效，且已明顯使用主要權益或續場功能。</li>
            <li>因帳號共享、違反服務條款或其他使用規範導致的停權或限制。</li>
            <li>因使用者自行輸入錯誤帳號資料、Email 或未及時聯繫客服造成的延誤。</li>
          </ul>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">4. 重複扣款處理</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            若你懷疑發生重複扣款，請於客服時段內聯繫我們並提供付款資訊。經查證屬實後，將優先退回重複收取的金額至原付款方式，並盡快以 Email 回覆處理進度。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">5. 權益未生效處理</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            若你已完成付款，但 VIP 權益沒有立即更新，請提供付款時間、金額與帳號 Email。經確認後，我們將優先協助人工開通；若仍無法正常提供服務，可依本政策辦理退款。
          </p>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
