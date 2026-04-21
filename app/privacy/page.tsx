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

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">4. 驗證與 OTP 說明</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            若未來啟用手機驗證、一次性密碼（OTP）或其他安全驗證機制，你在輸入手機號碼並請求驗證碼時，
            即表示你同意安感島或其合作服務供應商為了登入驗證、帳號安全、付款風險控管、濫用防制或客服確認之目的，
            向你發送簡訊、語音或其他形式的驗證訊息。若你的電信業者會收取簡訊或數據費用，該費用由你自行負擔。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">5. 第三方服務供應商與資料揭露</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            為了提供帳號、資料儲存、即時影音、付款、客服、通知、OTP 驗證、AI 功能或未來的身分驗證服務，
            我們可能委託第三方服務供應商處理資料，但僅限於其提供服務所必要的範圍。這些供應商可能包含：
          </p>
          <ul className="cc-bullets">
            <li>帳號 / 資料儲存 / 後端基礎設施供應商</li>
            <li>即時影音或通訊服務供應商</li>
            <li>付款與查單服務供應商</li>
            <li>客服表單或通知服務供應商</li>
            <li>若未來導入：OTP / 簡訊驗證服務供應商</li>
            <li>若未來導入：AI 功能或推薦服務供應商</li>
            <li>若未來導入：身分驗證 / KYC 服務供應商</li>
          </ul>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            若未來正式導入新的第三方供應商，且其會處理你的個人資料，我們會同步更新本頁與相關說明。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">6. 我們是否販售你的個人資料</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            安感島不以販售你的個人資料為目的。我們揭露資料的範圍，以提供服務、處理交易、驗證安全、履行法令義務與處理客服需求為限。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">7. 保存期間</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            我們會依服務提供、交易查核、客服處理、風險控管與法令遵循的必要範圍保存資料。
            不同類型的資料可能有不同保存期間；若未來導入身分驗證資料，我們也會依其敏感程度與法令要求另行訂定保存與刪除規則。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">8. 你的權利與聯絡方式</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            若你希望查詢、修改或刪除與你相關的資料，或對於驗證、資料使用或第三方揭露有疑問，
            可透過客服頁與客服表單聯絡我們。我們會依實際情況、法令義務與服務安全需要進行處理。
          </p>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
