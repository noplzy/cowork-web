import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { BUSINESS_PROFILE } from "@/lib/businessProfile";

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
          <h2 className="cc-h3">1. 營運主體</h2>
          <div className="cc-note cc-stack-sm">
            <div>品牌名稱：{BUSINESS_PROFILE.brandName}</div>
            <div>商業名稱：{BUSINESS_PROFILE.legalBusinessName}</div>
            <div>統一編號：{BUSINESS_PROFILE.unifiedBusinessNo}</div>
            <div>{BUSINESS_PROFILE.publicAddressNote}</div>
            <div>Email：{BUSINESS_PROFILE.supportEmail}</div>
            <div>電話：{BUSINESS_PROFILE.supportPhone}</div>
          </div>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">2. 服務內容</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            安感島目前提供同行空間、帳號方案、客服支援與公開政策頁。實際服務內容、
            使用限制與方案條件，以網站當下公開頁面與付款前揭露資訊為準。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">3. 目前計價模式</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            目前只開放 VIP 月方案的一次性付款版本。付款成功後，系統會開通 30 天 VIP 權益。
            目前不做自動續扣，也沒有前台自行取消續訂功能。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">4. 付款、開通與查單</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            付款成功後，系統會先接收付款通知並進行後端驗證，確認完成後才把 VIP 權益入帳。
            若你已付款但權益未在合理時間內生效，請透過客服表單提供帳號 Email、付款時間、
            金額與訂單編號，我們會協助查單與處理。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">5. 驗證、風險控管與限制使用</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            為了保護帳號安全、付款安全、房內秩序與平台治理，安感島得在特定情況下要求你完成手機驗證、
            OTP 驗證、聯絡方式確認，或其他合理的身分 / 資格驗證程序。若你拒絕完成必要驗證、
            提供明顯不實資料、冒用他人身分或驗證結果顯示存在重大風險，我們得限制部分功能、延後開通、
            拒絕特定交易，或暫停服務。
          </p>
          <div className="cc-action-row">
            <Link href="/verification-policy" className="cc-btn">
              查看驗證與安全政策
            </Link>
            <Link href="/contact" className="cc-btn">
              驗證 / 帳號客服
            </Link>
          </div>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">6. 退款與人工審核</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            目前退款依照公開退款政策進行人工審核。是否退款，會以是否重複扣款、
            權益是否未生效、是否為首次訂購且尚未實際使用主要 VIP 權益等條件綜合判定。
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
          <h2 className="cc-h3">7. 帳號責任與禁止行為</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            你應妥善保管自己的登入資訊，不得將帳號權限提供他人共用。若因帳號共享、不當使用、濫用服務、
            干擾房間秩序、違法或侵權行為導致權益異常，安感島有權限制服務、中止權益或拒絕退款申請。
          </p>
          <ul className="cc-bullets">
            <li>不得濫用服務或干擾房間秩序</li>
            <li>不得分享、轉售或借用帳號權益</li>
            <li>不得從事違法、侵權、騷擾或其他損害他人權益的行為</li>
            <li>不得以不實或冒用資料完成驗證、付款或帳號申請</li>
          </ul>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">8. 第三方服務供應商</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            為了提供帳號、付款、客服、影音、通知、安全驗證、AI 功能或未來的身分驗證服務，
            安感島可能委託第三方服務供應商處理必要資料。實際的資料使用方式，以隱私權政策與相關揭露頁面為準。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">9. 後續方案若有更新，將另行公告</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            月訂閱與年方案若未來開放，會在公開頁面另外說明價格、適用規則與相關流程。
          </p>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
