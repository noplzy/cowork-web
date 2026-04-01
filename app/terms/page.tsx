import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";

export default function TermsPage() {
  return (
    <main className="cc-container">
      <TopNav />

      <section className="cc-card cc-stack-lg">
        <div className="cc-stack-sm">
          <span className="cc-kicker">Terms of Service</span>
          <p className="cc-eyebrow">服務條款</p>
          <h1 className="cc-h2">安感島服務條款</h1>
        </div>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">1. 服務內容</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            安感島目前提供專注共工房間、帳號方案、客服支援與公開政策頁。
            實際服務內容、使用限制與方案條件，以網站當下公開頁面與付款前揭露資訊為準。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">2. 試營運計價模式</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            目前採試營運模式，只開放 VIP 月方案的一次性付款版本。
            付款成功後，系統會開通 30 天 VIP 權益。這一版不做自動續扣，也不提供前台自行取消續訂功能，
            因為目前根本沒有續訂在跑。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">3. 付款、開通與查單</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            付款成功後，系統會先接收付款通知並進行後端驗證，確認完成後才把 VIP 權益入帳。
            若你已付款但權益未在合理時間內生效，請透過客服表單提供帳號 Email、付款時間、金額與訂單編號，
            我們會先人工查單與處理。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">4. 退款與人工審核</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            目前退款不採前台即時自助處理，而是依照公開退款政策進行人工審核。
            是否退款，會以是否重複扣款、權益是否未生效、是否為首次訂購且尚未實際使用主要 VIP 權益等條件綜合判定。
          </p>
          <div className="cc-action-row">
            <Link href="/refund-policy" className="cc-btn">
              查看退款政策
            </Link>
            <Link href="/contact" className="cc-btn">
              前往客服表單
            </Link>
          </div>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">5. 帳號責任與禁止行為</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            你應妥善保管自己的登入資訊，不得將帳號權限提供他人共用。若因帳號共享、
            不當使用、濫用服務、干擾房間秩序、違法或侵權行為導致權益異常，安感島有權限制服務、
            中止權益或拒絕退款申請。
          </p>
          <ul className="cc-bullets">
            <li>不得濫用服務或干擾房間秩序</li>
            <li>不得分享、轉售或借用帳號權益</li>
            <li>不得從事違法、侵權、騷擾或其他損害他人權益的行為</li>
          </ul>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">6. 正式上線保留方案</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            月訂閱與年方案會保留到正式上線階段再開放。等自動扣款、查單、取消與客服流程穩定後，
            我們才會公開新的方案條件、價格與適用規則。在正式上線前，網站若出現保留中的方案卡片，
            只代表未來規劃，不代表已可購買。
          </p>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
