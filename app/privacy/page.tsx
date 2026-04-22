import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { BUSINESS_PROFILE } from "@/lib/businessProfile";

export default function PrivacyPage() {
  return (
    <main className="cc-container">
      <TopNav />

      <section className="cc-card cc-stack-lg">
        <div className="cc-stack-sm">
          <span className="cc-kicker">Privacy Policy</span>
          <p className="cc-eyebrow">隱私權政策</p>
          <h1 className="cc-h2">安感島隱私權政策</h1>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            這一頁說明安感島在提供帳號、同行空間、付款、客服、驗證與安全機制時，可能如何蒐集、使用、
            保存與揭露你的個人資料。若未來新增第三方服務供應商或身分驗證機制，本頁也會同步更新。
          </p>
        </div>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">1. 資料控制者與聯絡方式</h2>
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
          <h2 className="cc-h3">2. 我們可能蒐集哪些資料</h2>
          <ul className="cc-bullets">
            <li>帳號資料：Email、登入資訊、帳號識別資訊</li>
            <li>聯絡資料：你主動提供的電話、客服表單內容、回覆資訊</li>
            <li>交易資料：付款時間、金額、付款狀態、訂單編號、查單紀錄</li>
            <li>服務使用資料：進房紀錄、權益狀態、裝置與基本系統紀錄、異常排查紀錄</li>
            <li>驗證資料：手機驗證紀錄、驗證時間、風險控管所需的安全紀錄</li>
            <li>若未來需要身分驗證：法定姓名、出生年月日、證件資訊、證件影像、自拍 / 活體檢測結果等必要資料</li>
          </ul>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">3. 這些資料拿來做什麼</h2>
          <ul className="cc-bullets">
            <li>建立與維護帳號、登入狀態與方案權益</li>
            <li>處理付款、退款、查單與客服需求</li>
            <li>維持同行空間、系統安全、濫用防制與異常排查</li>
            <li>寄送或發送登入驗證碼、風險警示、服務通知與必要的安全訊息</li>
            <li>在特定情況下進行身分或資格驗證，以保護使用者與平台安全</li>
          </ul>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
