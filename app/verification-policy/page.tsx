import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { BUSINESS_PROFILE } from "@/lib/businessProfile";

export default function VerificationPolicyPage() {
  return (
    <main className="cc-container">
      <TopNav />

      <section className="cc-card cc-stack-lg">
        <div className="cc-stack-sm">
          <span className="cc-kicker">Verification & Security Policy</span>
          <p className="cc-eyebrow">驗證與安全政策</p>
          <h1 className="cc-h2">什麼情況下可能需要驗證、我們會怎麼處理</h1>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            安感島希望把驗證做成必要時才啟用的安全機制，而不是把一般使用者一開始就推進高壓流程。
            這一頁用來說明手機驗證、OTP 驗證、聯絡方式確認，以及未來可能導入的身分驗證規則。
          </p>
        </div>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">1. 哪些情況可能需要驗證</h2>
          <ul className="cc-bullets">
            <li>建立帳號、重設登入資訊、登入異常或安全風險較高時</li>
            <li>付款風險控管、查單、退款審核或客服確認時</li>
            <li>帳號異常、濫用行為、多人共用、疑似冒用或違規申訴時</li>
            <li>未來若開放更高信任等級功能、交易或預約服務時</li>
          </ul>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">2. 手機驗證與 OTP</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            若平台要求手機驗證或 OTP，一般代表系統需要確認登入者、付款者或操作人是否為帳號本人，
            以降低盜用、濫用、詐欺或付款風險。你在輸入手機號碼並請求驗證碼時，
            即表示你同意安感島或其合作供應商向你發送驗證訊息。若電信業者向你收取費用，該費用由你自行負擔。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">3. 未來可能導入的身分驗證</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            若未來安感島需要導入身分證驗證、KYC、證件核驗或活體檢測，通常只會在高風險情境、
            高信任場景、法令要求或特定服務必要時才啟用，不會預設要求所有一般使用者一開始就完成。
          </p>
          <ul className="cc-bullets">
            <li>可能蒐集：法定姓名、出生年月日、證件資訊、證件影像、自拍 / 活體檢測結果</li>
            <li>可能用途：帳號安全、反詐欺、履約能力確認、法令遵循、爭議處理</li>
            <li>若未來正式導入，我們會同步更新本頁與隱私權政策</li>
          </ul>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">4. 驗證失敗會怎麼處理</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            若驗證失敗、資料不一致、結果顯示高風險，或你拒絕完成平台認定為必要的驗證程序，
            安感島得依情況延後開通、限制功能、要求補件、拒絕特定交易，或暫停相關權益。
            若屬於系統或資料誤判，也可透過客服申請人工覆核。
          </p>
          <div className="cc-action-row">
            <Link href="/contact" className="cc-btn-primary">
              驗證 / 帳號客服
            </Link>
            <Link href="/privacy" className="cc-btn">
              隱私權政策
            </Link>
          </div>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">5. 驗證資料怎麼保存</h2>
          <p className="cc-muted" style={{ margin: 0, lineHeight: 1.8 }}>
            驗證相關資料只會在提供服務、安全控管、爭議處理與法令遵循必要範圍內保存。
            若未來正式導入身分驗證供應商，我們也會補充更明確的保存期間、刪除方式與資料權利說明。
          </p>
        </article>

        <article className="cc-card cc-card-soft cc-stack-sm">
          <h2 className="cc-h3">6. 營運主體與聯絡方式</h2>
          <div className="cc-note cc-stack-sm">
            <div>商業名稱：{BUSINESS_PROFILE.legalBusinessName}</div>
            <div>統一編號：{BUSINESS_PROFILE.unifiedBusinessNo}</div>
            <div>{BUSINESS_PROFILE.publicAddressNote}</div>
            <div>Email：{BUSINESS_PROFILE.supportEmail}</div>
            <div>電話：{BUSINESS_PROFILE.supportPhone}</div>
          </div>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
