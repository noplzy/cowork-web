import Link from "next/link";
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
          <h2 className="cc-h3">1. 目前提供的付費服務</h2>
          <ul className="cc-bullets">
            <li>試營運期間目前只開放 VIP 月方案</li>
            <li>付款成功後可取得 30 天 VIP 權益</li>
            <li>目前不做自動續扣，也不提供年方案購買</li>
          </ul>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">2. 付款後的交付流程</h2>
          <ul className="cc-bullets">
            <li>建立訂單並導轉至綠界付款頁</li>
            <li>付款完成後，系統接收付款結果與後端查單驗證</li>
            <li>驗證成功後，VIP 權益才真正入帳</li>
            <li>你可在付款結果頁與帳號中心查看目前狀態</li>
          </ul>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">3. 權益在哪裡看</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            登入後可在「帳號中心」查看目前方案、VIP 是否生效、VIP 到期時間與本月可用額度。
            付款完成後，也可以先到付款結果頁確認是否已完成入帳。
          </p>
          <div className="cc-action-row">
            <Link href="/account" className="cc-btn">
              前往帳號中心
            </Link>
            <Link href="/pricing" className="cc-btn">
              回方案頁
            </Link>
          </div>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">4. 若權益未生效</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            若你已付款但權益未生效，請先準備帳號 Email、付款時間、金額與訂單編號，透過客服表單申請人工處理。
            我們會先人工查單、補開通；若最終無法正常提供已付款權益，再依退款政策處理。
          </p>
          <div className="cc-action-row">
            <Link href="/contact" className="cc-btn-primary">
              前往客服表單
            </Link>
            <Link href="/refund-policy" className="cc-btn">
              退款政策
            </Link>
          </div>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">5. 正式上線保留方案</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            月訂閱與年方案會保留到正式上線再開放。等自動扣款、取消流程、查單與客服流程都穩定後，
            才會另外公告新的交付與續約規則。
          </p>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
